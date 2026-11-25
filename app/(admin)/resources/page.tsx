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
import { setFlags } from "@/lib/ordering";
import {
  getErrorMessage,
  safeExternalHref,
  sortByCreatedAtDesc,
  validateHttpsUrl,
} from "@/lib/format";
import {
  RESOURCE_KINDS,
  type ResourceItem,
  type ResourceKind,
} from "@/lib/types";
import { ModalDialog } from "@/components/modal-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Edit2, ExternalLink, Plus, Search, Trash2 } from "lucide-react";

const KIND_LABELS: Record<ResourceKind, string> = {
  notes: "Notes",
  lab: "Lab manuals",
  code: "Code",
  exam: "Question banks",
  other: "Other",
};

interface ResourceFormState {
  title: string;
  kind: ResourceKind;
  course: string;
  fileType: string;
  size: string;
  url: string;
  published: boolean;
}

const emptyForm: ResourceFormState = {
  title: "",
  kind: "notes",
  course: "",
  fileType: "PDF",
  size: "",
  url: "",
  published: true,
};

export default function ResourcesPage() {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | ResourceKind>("all");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ResourceFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ResourceItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "resources"));
      setResources(
        sortByCreatedAtDesc(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as ResourceItem))
        )
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to load resources. Check database permissions."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources.filter((item) => {
      if (kindFilter !== "all" && item.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        String(item.title ?? "").toLowerCase().includes(q) ||
        String(item.course ?? "").toLowerCase().includes(q) ||
        String(item.fileType ?? "").toLowerCase().includes(q) ||
        String(item.url ?? "").toLowerCase().includes(q)
      );
    });
  }, [resources, kindFilter, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      kind: kindFilter === "all" ? "notes" : kindFilter,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (item: ResourceItem) => {
    setEditingId(item.id);
    setForm({
      title: String(item.title ?? ""),
      kind: RESOURCE_KINDS.includes(item.kind) ? item.kind : "notes",
      course: String(item.course ?? ""),
      fileType: String(item.fileType ?? ""),
      size: String(item.size ?? ""),
      url: String(item.url ?? ""),
      published: Boolean(item.published),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const title = form.title.trim();
    const course = form.course.trim();
    const fileType = form.fileType.trim();
    const size = form.size.trim();

    if (!title || title.length > 200) {
      setFormError("Title is required and must be 200 characters or fewer.");
      return;
    }
    if (!RESOURCE_KINDS.includes(form.kind)) {
      setFormError("Select a valid resource kind.");
      return;
    }
    if (course.length > 60) {
      setFormError("Course must be 60 characters or fewer.");
      return;
    }
    if (fileType.length > 20) {
      setFormError("File type must be 20 characters or fewer.");
      return;
    }
    if (size.length > 20) {
      setFormError("Size must be 20 characters or fewer.");
      return;
    }

    const urlCheck = validateHttpsUrl(form.url, {
      required: true,
      label: "Download URL",
    });
    if (!urlCheck.ok) {
      setFormError(urlCheck.error);
      return;
    }

    const published = Boolean(form.published);
    const now = Date.now();

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "resources", editingId), {
          title,
          kind: form.kind,
          course: course || deleteField(),
          fileType: fileType || deleteField(),
          size: size || deleteField(),
          url: urlCheck.value,
          published,
          updatedAt: now,
        });
      } else {
        const payload: Record<string, string | number | boolean> = {
          title,
          kind: form.kind,
          url: urlCheck.value,
          published,
          createdAt: now,
          updatedAt: now,
        };
        if (course) payload.course = course;
        if (fileType) payload.fileType = fileType;
        if (size) payload.size = size;
        await addDoc(collection(db, "resources"), payload);
      }
      setModalOpen(false);
      await fetchResources();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save resource."));
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (item: ResourceItem) => {
    const published = !Boolean(item.published);
    try {
      const updatedAt = await setFlags("resources", item.id, { published });
      setResources((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, published, updatedAt } : r))
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
      await deleteDoc(doc(db, "resources", deleteTarget.id));
      setResources((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete resource."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            id="resources-table-heading"
            className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]"
          >
            Resources
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage lecture notes, lab manuals, code packs, and question banks (https:// links).
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm px-5 py-2.5 shadow-sm hover:brightness-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Resource
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by kind">
          <button
            type="button"
            onClick={() => setKindFilter("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              kindFilter === "all"
                ? "bg-[#08090B] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({resources.length})
          </button>
          {RESOURCE_KINDS.map((kind) => {
            const count = resources.filter((r) => r.kind === kind).length;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setKindFilter(kind)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  kindFilter === kind
                    ? "bg-[#D7FF3D] text-[#08090B] ring-1 ring-[#08090B]/20"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {KIND_LABELS[kind]} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, course, type…"
            aria-label="Search resources"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3.5 py-2 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
          />
        </div>
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
          Loading resources…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-500">
          {resources.length === 0
            ? "No resources yet. Add one or load demo content from the dashboard."
            : "No resources match your current filter."}
        </div>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="resources-table-heading"
          className="overflow-x-auto max-h-[70vh] rounded-2xl border border-slate-200 bg-white outline-none focus-visible:ring-2 focus-visible:ring-[#D7FF3D]"
        >
          <table className="w-full text-left border-separate border-spacing-0 min-w-[720px]">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3.5 border-b border-slate-200">
                  Title
                </th>
                <th scope="col" className="px-4 py-3.5 border-b border-slate-200">
                  Kind
                </th>
                <th scope="col" className="px-4 py-3.5 border-b border-slate-200">
                  Course
                </th>
                <th scope="col" className="px-4 py-3.5 border-b border-slate-200">
                  File / Size
                </th>
                <th scope="col" className="px-4 py-3.5 border-b border-slate-200">
                  Status
                </th>
                <th
                  scope="col"
                  className="px-5 py-3.5 border-b border-slate-200 text-right"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((item) => {
                const safeUrl = safeExternalHref(item.url, { httpsOnly: true });
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-[#08090B]">
                      <div className="max-w-sm">
                        <p className="truncate" title={item.title}>
                          {item.title}
                        </p>
                        <p className="text-xs font-mono font-normal text-slate-400 truncate">
                          {item.url}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 whitespace-nowrap">
                        {KIND_LABELS[item.kind] ?? item.kind}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {item.course || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {[item.fileType, item.size].filter(Boolean).join(" · ") ||
                        "—"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleTogglePublished(item)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                          item.published
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-slate-100 border-slate-200 text-slate-600"
                        }`}
                      >
                        {item.published ? "Published" : "Draft"}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {safeUrl && (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${item.title}`}
                            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <ExternalLink
                              className="w-4 h-4"
                              aria-hidden="true"
                            />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          aria-label={`Edit ${item.title}`}
                          className="p-2 rounded-xl bg-slate-100 text-[#08090B] hover:bg-[#D7FF3D] transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          aria-label={`Delete ${item.title}`}
                          className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Resource" : "Add Resource"}
        maxWidthClass="max-w-xl"
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

          <div>
            <label
              htmlFor="res-title"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Title * (max 200)
            </label>
            <input
              id="res-title"
              type="text"
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Circuit Analysis II — complete lecture notes"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="res-kind"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Kind *
              </label>
              <select
                id="res-kind"
                value={form.kind}
                onChange={(e) =>
                  setForm({ ...form, kind: e.target.value as ResourceKind })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              >
                {RESOURCE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="res-course"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Course (optional)
              </label>
              <input
                id="res-course"
                type="text"
                maxLength={60}
                value={form.course}
                onChange={(e) => setForm({ ...form, course: e.target.value })}
                placeholder="EEE 2101"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="res-filetype"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                File Type (optional)
              </label>
              <input
                id="res-filetype"
                type="text"
                maxLength={20}
                value={form.fileType}
                onChange={(e) => setForm({ ...form, fileType: e.target.value })}
                placeholder="PDF or ZIP"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="res-size"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Size (optional)
              </label>
              <input
                id="res-size"
                type="text"
                maxLength={20}
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                placeholder="14 MB"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="res-url"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Download URL * (https:// only)
            </label>
            <input
              id="res-url"
              type="url"
              required
              maxLength={500}
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com/resources/eee-2101-notes.pdf"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <label className="inline-flex items-center gap-2.5 text-sm font-medium text-[#08090B] cursor-pointer pt-1">
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
              {saving
                ? "Saving…"
                : editingId
                ? "Save Changes"
                : "Create Resource"}
            </button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete resource"
        message={
          deleteTarget ? `Permanently delete "${deleteTarget.title}"?` : ""
        }
      />
    </div>
  );
}
