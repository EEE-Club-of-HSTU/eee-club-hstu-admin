"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isValidInt } from "@/lib/format";
import { setFlags } from "@/lib/ordering";
import {
  getErrorMessage,
  resolveMediaUrl,
  safeExternalHref,
  validateHexColor,
  validateHttpsUrl,
  validateMediaUrl,
} from "@/lib/format";
import type { MagazineIssue, MagazineTocEntry } from "@/lib/types";
import { ModalDialog } from "@/components/modal-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  ArrowDown,
  ArrowUp,
  Edit2,
  ExternalLink,
  Plus,
  Trash2,
  X,
} from "lucide-react";

interface TocDraftRow {
  page: string;
  title: string;
}

interface MagazineFormState {
  issueNumber: string;
  title: string;
  season: string;
  summary: string;
  coverImageUrl: string;
  coverColor: string;
  pdfUrl: string;
  pages: string;
  contents: TocDraftRow[];
  published: boolean;
}

const MAX_TOC_ENTRIES = 30;

export default function MagazinePage() {
  const [issues, setIssues] = useState<MagazineIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MagazineFormState>({
    issueNumber: "1",
    title: "",
    season: "",
    summary: "",
    coverImageUrl: "",
    coverColor: "#D7FF3D",
    pdfUrl: "",
    pages: "",
    contents: [],
    published: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<MagazineIssue | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "magazines"));
      setIssues(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as MagazineIssue))
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to load Pulse issues. Check database permissions."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const sortedIssues = useMemo(() => {
    return [...issues].sort(
      (a, b) => (b.issueNumber ?? 0) - (a.issueNumber ?? 0)
    );
  }, [issues]);

  const highestIssueNumber = sortedIssues[0]?.issueNumber;

  const openCreate = () => {
    const nextIssue =
      sortedIssues.length > 0 ? (sortedIssues[0].issueNumber ?? 0) + 1 : 1;
    setEditingId(null);
    setForm({
      issueNumber: String(nextIssue),
      title: "",
      season: "",
      summary: "",
      coverImageUrl: "",
      coverColor: "#D7FF3D",
      pdfUrl: "",
      pages: "",
      contents: [],
      published: true,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (issue: MagazineIssue) => {
    setEditingId(issue.id);
    setForm({
      issueNumber: String(
        Number.isInteger(issue.issueNumber) ? issue.issueNumber : 1
      ),
      title: String(issue.title ?? ""),
      season: String(issue.season ?? ""),
      summary: String(issue.summary ?? ""),
      coverImageUrl: String(issue.coverImageUrl ?? ""),
      coverColor: String(issue.coverColor ?? ""),
      pdfUrl: String(issue.pdfUrl ?? ""),
      pages:
        typeof issue.pages === "number" && Number.isInteger(issue.pages)
          ? String(issue.pages)
          : "",
      contents: Array.isArray(issue.contents)
        ? issue.contents.slice(0, MAX_TOC_ENTRIES).map((row) => ({
            page: String(row.page ?? ""),
            title: String(row.title ?? ""),
          }))
        : [],
      published: Boolean(issue.published),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const addTocRow = () => {
    if (form.contents.length >= MAX_TOC_ENTRIES) return;
    setForm((prev) => ({
      ...prev,
      contents: [...prev.contents, { page: "", title: "" }],
    }));
  };

  const updateTocRow = (
    idx: number,
    key: "page" | "title",
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      contents: prev.contents.map((row, i) =>
        i === idx ? { ...row, [key]: value } : row
      ),
    }));
  };

  const removeTocRow = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      contents: prev.contents.filter((_, i) => i !== idx),
    }));
  };

  const moveTocRow = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= form.contents.length) return;
    setForm((prev) => {
      const next = [...prev.contents];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return { ...prev, contents: next };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const issueNumber = Number(form.issueNumber.trim());
    const title = form.title.trim();
    const season = form.season.trim();
    const summary = form.summary.trim();

    if (!isValidInt(issueNumber) || issueNumber < 1) {
      setFormError("Issue number must be a whole number from 1 to 9999.");
      return;
    }
    // Two issues with one number would make the public site's "latest issue" unpredictable.
    const clash = issues.find((m) => m.issueNumber === issueNumber && m.id !== editingId);
    if (clash) {
      setFormError(`Issue ${issueNumber} already exists ("${clash.title}"). Choose another number.`);
      return;
    }
    if (!title || title.length > 160) {
      setFormError("Title is required and must be 160 characters or fewer.");
      return;
    }
    if (!season || season.length > 60) {
      setFormError("Season is required and must be 60 characters or fewer.");
      return;
    }
    if (summary.length > 1000) {
      setFormError("Summary must be 1000 characters or fewer.");
      return;
    }

    const coverCheck = validateMediaUrl(form.coverImageUrl, {
      label: "Cover image URL",
    });
    if (!coverCheck.ok) {
      setFormError(coverCheck.error);
      return;
    }

    const colorCheck = validateHexColor(form.coverColor);
    if (!colorCheck.ok) {
      setFormError(colorCheck.error);
      return;
    }

    const pdfCheck = validateHttpsUrl(form.pdfUrl, { label: "PDF URL" });
    if (!pdfCheck.ok) {
      setFormError(pdfCheck.error);
      return;
    }

    let pagesNum: number | undefined;
    if (form.pages.trim()) {
      const p = Number(form.pages.trim());
      if (!isValidInt(p) || p < 1) {
        setFormError("Pages must be a positive integer.");
        return;
      }
      pagesNum = p;
    }

    if (form.contents.length > MAX_TOC_ENTRIES) {
      setFormError(`Table of contents can have at most ${MAX_TOC_ENTRIES} entries.`);
      return;
    }

    const validatedContents: MagazineTocEntry[] = [];
    for (let i = 0; i < form.contents.length; i += 1) {
      const row = form.contents[i];
      const p = Number(row.page.trim());
      const t = row.title.trim();
      if (!isValidInt(p) || p < 1) {
        setFormError(`Contents row ${i + 1}: page must be a positive integer.`);
        return;
      }
      if (!t || t.length > 200) {
        setFormError(
          `Contents row ${i + 1}: title is required (200 chars max).`
        );
        return;
      }
      validatedContents.push({ page: p, title: t });
    }

    const published = Boolean(form.published);
    const now = Date.now();

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "magazines", editingId), {
          issueNumber,
          title,
          season,
          summary: summary || deleteField(),
          coverImageUrl: coverCheck.value || deleteField(),
          coverColor: colorCheck.value || deleteField(),
          pdfUrl: pdfCheck.value || deleteField(),
          pages: pagesNum ?? deleteField(),
          contents:
            validatedContents.length > 0 ? validatedContents : deleteField(),
          published,
          updatedAt: now,
        });
      } else {
        const payload: Record<
          string,
          string | number | boolean | MagazineTocEntry[]
        > = {
          issueNumber,
          title,
          season,
          published,
          createdAt: now,
          updatedAt: now,
        };
        if (summary) payload.summary = summary;
        if (coverCheck.value) payload.coverImageUrl = coverCheck.value;
        if (colorCheck.value) payload.coverColor = colorCheck.value;
        if (pdfCheck.value) payload.pdfUrl = pdfCheck.value;
        if (pagesNum !== undefined) payload.pages = pagesNum;
        if (validatedContents.length > 0) payload.contents = validatedContents;
        await addDoc(collection(db, "magazines"), payload);
      }
      setModalOpen(false);
      await fetchIssues();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save magazine issue."));
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (issue: MagazineIssue) => {
    const published = !Boolean(issue.published);
    try {
      const updatedAt = await setFlags("magazines", issue.id, { published });
      setIssues((prev) =>
        prev.map((m) =>
          m.id === issue.id ? { ...m, published, updatedAt } : m
        )
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update published state."));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "magazines", deleteTarget.id));
      setIssues((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete magazine issue."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
            Pulse Magazine
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage issues, cover colours, PDF links, and table of contents (highest issue is featured).
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm px-5 py-2.5 shadow-sm hover:brightness-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Issue
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <strong className="font-semibold">Database Error: </strong>
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">
          Loading magazine issues…
        </div>
      ) : sortedIssues.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-500">
          No Pulse issues yet. Add an issue or load demo content from the dashboard.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedIssues.map((issue) => {
            const coverSrc = resolveMediaUrl(issue.coverImageUrl);
            const safePdf = safeExternalHref(issue.pdfUrl, { httpsOnly: true });
            const isLatest = issue.issueNumber === highestIssueNumber;
            // coverColor may be anything if edited in the console: only trust a #RRGGBB string.
            const bgColor =
              typeof issue.coverColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(issue.coverColor)
                ? issue.coverColor
                : "#08090B";
            const lightText =
              bgColor.toUpperCase() === "#181B21" ||
              bgColor.toUpperCase() === "#08090B" ||
              bgColor.toUpperCase() === "#4D6BFF";

            return (
              <div
                key={issue.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div
                    className="w-16 h-20 rounded-xl border border-slate-200 shrink-0 overflow-hidden flex flex-col justify-between p-2"
                    style={{
                      backgroundColor: bgColor,
                      color: lightText ? "#F3F2EE" : "#08090B",
                    }}
                  >
                    {coverSrc ? (
                      <img
                        src={coverSrc}
                        alt={issue.title}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <>
                        <span className="text-[10px] font-mono font-bold">
                          #{String(issue.issueNumber).padStart(2, "0")}
                        </span>
                        <span className="text-xs font-bold leading-none">
                          Pulse
                        </span>
                      </>
                    )}
                  </div>

                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-100 text-slate-700">
                        Issue {String(issue.issueNumber).padStart(2, "0")}
                      </span>
                      <h2 className="font-bold text-base text-[#08090B]">
                        {issue.title}
                      </h2>
                      {isLatest && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#D7FF3D] text-[#08090B]">
                          Latest
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          issue.published
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {issue.published ? "Published" : "Draft"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>{issue.season}</span>
                      {typeof issue.pages === "number" && (
                        <span>· {issue.pages} pages</span>
                      )}
                      {Array.isArray(issue.contents) &&
                        issue.contents.length > 0 && (
                          <span>· {issue.contents.length} TOC entries</span>
                        )}
                      {safePdf && (
                        <a
                          href={safePdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#08090B] hover:underline"
                        >
                          PDF
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}
                    </div>

                    {issue.summary && (
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {issue.summary}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTogglePublished(issue)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      issue.published
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {issue.published ? "Published" : "Publish"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(issue)}
                    aria-label={`Edit ${issue.title}`}
                    className="p-2 rounded-xl bg-slate-100 text-[#08090B] hover:bg-[#D7FF3D] transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(issue)}
                    aria-label={`Delete ${issue.title}`}
                    className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Magazine Issue" : "Add Magazine Issue"}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="mag-number"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Issue # *
              </label>
              <input
                id="mag-number"
                type="number"
                required
                min={1}
                step={1}
                value={form.issueNumber}
                onChange={(e) =>
                  setForm({ ...form, issueNumber: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="mag-title"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Title *
              </label>
              <input
                id="mag-title"
                type="text"
                required
                maxLength={160}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="The Grid Issue"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="mag-season"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Season *
              </label>
              <input
                id="mag-season"
                type="text"
                required
                maxLength={60}
                value={form.season}
                onChange={(e) => setForm({ ...form, season: e.target.value })}
                placeholder="Winter 2026"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="mag-pages"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Pages
              </label>
              <input
                id="mag-pages"
                type="number"
                min={1}
                step={1}
                value={form.pages}
                onChange={(e) => setForm({ ...form, pages: e.target.value })}
                placeholder="48"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="mag-color-hex"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Cover Colour (#RRGGBB)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick cover colour"
                  value={
                    /^#[0-9A-Fa-f]{6}$/.test(form.coverColor.trim())
                      ? form.coverColor.trim()
                      : "#D7FF3D"
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      coverColor: e.target.value.toUpperCase(),
                    })
                  }
                  className="h-10 w-12 rounded-xl border border-slate-300 bg-white p-1 cursor-pointer"
                />
                <input
                  id="mag-color-hex"
                  type="text"
                  maxLength={7}
                  value={form.coverColor}
                  onChange={(e) =>
                    setForm({ ...form, coverColor: e.target.value })
                  }
                  placeholder="#D7FF3D"
                  className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="mag-pdf"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                PDF URL (optional, https:// only)
              </label>
              <input
                id="mag-pdf"
                type="url"
                maxLength={500}
                value={form.pdfUrl}
                onChange={(e) => setForm({ ...form, pdfUrl: e.target.value })}
                placeholder="https://…"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="mag-cover-url"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Cover Image URL (optional)
              </label>
              <input
                id="mag-cover-url"
                type="text"
                maxLength={500}
                value={form.coverImageUrl}
                onChange={(e) =>
                  setForm({ ...form, coverImageUrl: e.target.value })
                }
                placeholder="https://… or assets/magazine/07.jpg"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="mag-summary"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Summary (optional, max 1000)
            </label>
            <textarea
              id="mag-summary"
              rows={2}
              maxLength={1000}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="Issue theme and editorial overview…"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Table of contents ({form.contents.length} / {MAX_TOC_ENTRIES})
              </span>
              <button
                type="button"
                disabled={form.contents.length >= MAX_TOC_ENTRIES}
                onClick={addTocRow}
                className="inline-flex items-center gap-1 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#08090B] hover:bg-[#D7FF3D] cursor-pointer disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Add Row
              </button>
            </div>

            {form.contents.length === 0 ? (
              <p className="text-xs text-slate-400">
                No table of contents entries added.
              </p>
            ) : (
              <div className="space-y-2">
                {form.contents.map((row, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2"
                  >
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={row.page}
                      onChange={(e) =>
                        updateTocRow(idx, "page", e.target.value)
                      }
                      placeholder="Page"
                      aria-label={`Row ${idx + 1} page number`}
                      className="w-20 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono text-[#08090B] outline-none focus:border-[#08090B]"
                    />
                    <input
                      type="text"
                      maxLength={200}
                      value={row.title}
                      onChange={(e) =>
                        updateTocRow(idx, "title", e.target.value)
                      }
                      placeholder="Article title"
                      aria-label={`Row ${idx + 1} article title`}
                      className="flex-1 min-w-[180px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-[#08090B] outline-none focus:border-[#08090B]"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveTocRow(idx, -1)}
                        aria-label={`Move TOC row ${idx + 1} up`}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                      >
                        <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === form.contents.length - 1}
                        onClick={() => moveTocRow(idx, 1)}
                        aria-label={`Move TOC row ${idx + 1} down`}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                      >
                        <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTocRow(idx)}
                        aria-label={`Remove TOC row ${idx + 1}`}
                        className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="inline-flex items-center gap-2.5 text-sm font-medium text-[#08090B] cursor-pointer">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) =>
                setForm({ ...form, published: e.target.checked })
              }
              className="w-4 h-4 accent-[#08090B]"
            />
            Published (visible on public site)
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#D7FF3D] text-[#08090B] text-sm font-semibold hover:brightness-95 cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving…" : editingId ? "Save Changes" : "Create Issue"}
            </button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete magazine issue"
        message={
          deleteTarget
            ? `Permanently delete Issue ${deleteTarget.issueNumber} — "${deleteTarget.title}"?`
            : ""
        }
      />
    </div>
  );
}
