"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { STATIC_PAGE_DEFAULTS } from "@/lib/static-page-defaults";
import { formatTimestamp, getErrorMessage } from "@/lib/format";
import {
  STATIC_PAGE_IDS,
  type StaticPageDoc,
  type StaticPageId,
} from "@/lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MarkdownPreview } from "@/components/markdown-preview";
import {
  ArrowLeft,
  Edit2,
  Eye,
  FileText,
  PenLine,
  RotateCcw,
  Save,
} from "lucide-react";

const PAGE_META: Record<
  StaticPageId,
  { label: string; defaultTitle: string; description: string }
> = {
  constitution: {
    label: "Constitution",
    defaultTitle: "Constitution — EEE Club of HSTU",
    description:
      "Club charter, membership rules, elections, wings, finance, and amendment procedure.",
  },
  history: {
    label: "History",
    defaultTitle: "History — EEE Club of HSTU",
    description:
      "Origins, milestones, past presidents, and founding timeline of the EEE Club.",
  },
  privacy: {
    label: "Privacy policy",
    defaultTitle: "Privacy Policy — EEE Club of HSTU",
    description:
      "How alumni registrations, contact messages, and Pulse newsletter emails are handled.",
  },
  terms: {
    label: "Terms of service",
    defaultTitle: "Terms of Service — EEE Club of HSTU",
    description:
      "Terms governing use of the EEE Club website, resources, and certificate verification.",
  },
};

export default function StaticPagesEditor() {
  const [docsById, setDocsById] = useState<
    Record<StaticPageId, StaticPageDoc | null>
  >({
    constitution: null,
    history: null,
    privacy: null,
    terms: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const [editingPageId, setEditingPageId] = useState<StaticPageId | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState<StaticPageId | null>(null);
  const [resetting, setResetting] = useState(false);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snaps = await Promise.all(
        STATIC_PAGE_IDS.map((id) => getDoc(doc(db, "pages_static", id)))
      );
      const next: Record<StaticPageId, StaticPageDoc | null> = {
        constitution: null,
        history: null,
        privacy: null,
        terms: null,
      };
      STATIC_PAGE_IDS.forEach((id, i) => {
        const snap = snaps[i];
        if (snap.exists()) {
          const data = snap.data();
          next[id] = {
            id,
            title: String(data.title ?? PAGE_META[id].defaultTitle),
            content: String(data.content ?? ""),
            updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : null,
          };
        }
      });
      setDocsById(next);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to load static pages. Check database permissions."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const startEdit = (id: StaticPageId) => {
    const existing = docsById[id];
    setEditingPageId(id);
    setTitle(existing ? existing.title : PAGE_META[id].defaultTitle);
    // Start from the site's built-in text, so fixing one sentence doesn't replace the whole page.
    setContent(existing ? existing.content : STATIC_PAGE_DEFAULTS[id]);
    setEditorTab("write");
    setFormError(null);
    setNoticeMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPageId) return;
    setFormError(null);
    setNoticeMsg(null);

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (!cleanTitle || cleanTitle.length > 200) {
      setFormError("Title is required and must be 200 characters or fewer.");
      return;
    }
    if (!cleanContent || cleanContent.length > 100000) {
      setFormError(
        "Markdown content is required and must be 100,000 characters or fewer."
      );
      return;
    }

    const updatedAt = Date.now();
    setSaving(true);
    try {
      await setDoc(doc(db, "pages_static", editingPageId), {
        title: cleanTitle,
        content: cleanContent,
        updatedAt,
      });
      setDocsById((prev) => ({
        ...prev,
        [editingPageId]: {
          id: editingPageId,
          title: cleanTitle,
          content: cleanContent,
          updatedAt,
        },
      }));
      setNoticeMsg(`${PAGE_META[editingPageId].label} saved.`);
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save static page."));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!resetTarget) return;
    setResetting(true);
    setError(null);
    setNoticeMsg(null);
    try {
      await deleteDoc(doc(db, "pages_static", resetTarget));
      setDocsById((prev) => ({ ...prev, [resetTarget]: null }));
      if (editingPageId === resetTarget) {
        setEditingPageId(null);
      }
      setNoticeMsg(
        `${PAGE_META[resetTarget].label} reset to the public site's built-in default.`
      );
      setResetTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reset page."));
    } finally {
      setResetting(false);
    }
  };

  if (editingPageId) {
    const meta = PAGE_META[editingPageId];
    const currentDoc = docsById[editingPageId];

    return (
      <div className="flex flex-col gap-5 h-full min-h-[calc(100vh-8rem)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingPageId(null);
                setFormError(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-[#08090B] hover:bg-slate-50 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              All Pages
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#08090B]">
                Edit {meta.label}
              </h1>
              <p className="text-xs text-slate-500">
                {currentDoc
                  ? `Last updated ${formatTimestamp(currentDoc.updatedAt)}`
                  : "Not yet customised in Firestore — saving will override the site default."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentDoc && (
              <button
                type="button"
                onClick={() => setResetTarget(editingPageId)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Reset to site default
              </button>
            )}
            <button
              type="submit"
              form="static-page-form"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#D7FF3D] text-[#08090B] text-xs font-semibold hover:brightness-95 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              {saving ? "Saving…" : "Save Page"}
            </button>
          </div>
        </div>

        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700"
          >
            {formError}
          </div>
        )}
        {noticeMsg && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-700"
          >
            {noticeMsg}
          </div>
        )}

        <form
          id="static-page-form"
          onSubmit={handleSave}
          className="flex-1 flex flex-col gap-4 min-h-0"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex-1">
              <label
                htmlFor="page-title"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Page Title * (max 200)
              </label>
              <input
                id="page-title"
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div className="flex lg:hidden items-center gap-1 bg-slate-100 p-1 rounded-xl self-start">
              <button
                type="button"
                onClick={() => setEditorTab("write")}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  editorTab === "write"
                    ? "bg-white text-[#08090B] shadow-xs"
                    : "text-slate-600"
                }`}
              >
                <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                Write
              </button>
              <button
                type="button"
                onClick={() => setEditorTab("preview")}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  editorTab === "preview"
                    ? "bg-white text-[#08090B] shadow-xs"
                    : "text-slate-600"
                }`}
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                Preview
              </button>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[460px]">
            <div
              className={`${
                editorTab === "preview" ? "hidden lg:flex" : "flex"
              } flex-col min-h-0`}
            >
              <label
                htmlFor="page-content"
                className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Markdown * ({content.length.toLocaleString()} / 100,000)
              </label>
              <textarea
                id="page-content"
                required
                maxLength={100000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write Markdown + LaTeX ($...$ / $$...$$)…"
                className="flex-1 min-h-[420px] w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-xs leading-relaxed text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D] resize-none"
              />
            </div>

            <div
              className={`${
                editorTab === "write" ? "hidden lg:flex" : "flex"
              } flex-col min-h-0`}
            >
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Live Preview
              </span>
              <div className="flex-1 min-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5">
                <MarkdownPreview content={content} />
              </div>
            </div>
          </div>
        </form>

        <ConfirmDialog
          open={resetTarget !== null}
          onClose={() => setResetTarget(null)}
          onConfirm={handleConfirmReset}
          loading={resetting}
          confirmLabel="Reset to default"
          title="Reset page to site default"
          message={
            resetTarget
              ? `Delete the custom Firestore copy of "${PAGE_META[resetTarget].label}" so the public site displays its built-in text?`
              : ""
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
          Static Pages
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Override the built-in Constitution, History, Privacy Policy, and Terms of Service pages with Markdown.
        </p>
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

      {noticeMsg && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {noticeMsg}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">
          Loading static pages…
        </div>
      ) : error ? (
        // Never allow editing after a failed load: a save could replace a page we couldn't read.
        <div className="py-12 text-center">
          <p className="text-sm text-slate-600 mb-4">
            Pages could not be loaded, so editing is disabled to protect the current content.
          </p>
          <button
            type="button"
            onClick={() => fetchPages()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D7FF3D] text-[#08090B] text-sm font-semibold hover:brightness-95 cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {STATIC_PAGE_IDS.map((id) => {
            const meta = PAGE_META[id];
            const docItem = docsById[id];
            return (
              <article
                key={id}
                className="rounded-[24px] border border-slate-200 bg-white p-6 flex flex-col justify-between gap-5 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-xs font-mono text-slate-500">
                      <FileText className="w-4 h-4" aria-hidden="true" />
                      pages_static/{id}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        docItem
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {docItem ? "Customised" : "Built-in default"}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-[#08090B]">
                    {meta.label}
                  </h2>
                  <p className="text-sm text-slate-600">{meta.description}</p>

                  <p className="text-xs text-slate-500 pt-1">
                    Last updated:{" "}
                    <span className="font-medium text-[#08090B]">
                      {docItem
                        ? formatTimestamp(docItem.updatedAt)
                        : "Built-in site text"}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => startEdit(id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D7FF3D] text-[#08090B] text-xs font-semibold hover:brightness-95 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                    {docItem ? "Edit Markdown" : "Create Custom Page"}
                  </button>
                  {docItem && (
                    <button
                      type="button"
                      onClick={() => setResetTarget(id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      Reset to site default
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={resetTarget !== null}
        onClose={() => setResetTarget(null)}
        onConfirm={handleConfirmReset}
        loading={resetting}
        confirmLabel="Reset to default"
        title="Reset page to site default"
        message={
          resetTarget
            ? `Delete the custom Firestore copy of "${PAGE_META[resetTarget].label}" so the public site displays its built-in text?`
            : ""
        }
      />
    </div>
  );
}
