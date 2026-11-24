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
import {
  getDhakaTodayDate,
  getErrorMessage,
  sortByCreatedAtDesc,
  validateContentLink,
} from "@/lib/format";
import { NOTICE_CATEGORIES, type Notice, type NoticeCategory } from "@/lib/types";
import { ModalDialog } from "@/components/modal-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Edit2, Pin, Plus, Trash2 } from "lucide-react";

interface NoticeFormState {
  title: string;
  body: string;
  category: NoticeCategory;
  noticeDate: string;
  link: string;
  pinned: boolean;
  published: boolean;
}

const createEmptyForm = (): NoticeFormState => ({
  title: "",
  body: "",
  category: "general",
  noticeDate: getDhakaTodayDate(),
  link: "",
  pinned: false,
  published: true,
});

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NoticeFormState>(createEmptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Notice | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "notices"));
      setNotices(
        sortByCreatedAtDesc(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notice))
        )
      );
    } catch (err) {
      setError(
        getErrorMessage(err, "Failed to load notices. Check database permissions.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const sortedNotices = useMemo(() => {
    return [...notices].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return String(b.noticeDate ?? "").localeCompare(String(a.noticeDate ?? ""));
    });
  }, [notices]);

  const openCreate = () => {
    setEditingId(null);
    setForm(createEmptyForm());
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (notice: Notice) => {
    setEditingId(notice.id);
    setForm({
      title: String(notice.title ?? ""),
      body: String(notice.body ?? ""),
      category: NOTICE_CATEGORIES.includes(notice.category)
        ? notice.category
        : "general",
      noticeDate: String(notice.noticeDate ?? ""),
      link: String(notice.link ?? ""),
      pinned: Boolean(notice.pinned),
      published: Boolean(notice.published),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const title = form.title.trim();
    const body = form.body.trim();
    const noticeDate = form.noticeDate.trim();

    if (!title || title.length > 200) {
      setFormError("Title is required and must be 200 characters or fewer.");
      return;
    }
    if (!body || body.length > 1000) {
      setFormError("Body is required and must be 1000 characters or fewer.");
      return;
    }
    if (!NOTICE_CATEGORIES.includes(form.category)) {
      setFormError("Select a valid notice category.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(noticeDate)) {
      setFormError("Notice date must be YYYY-MM-DD.");
      return;
    }

    const linkCheck = validateContentLink(form.link);
    if (!linkCheck.ok) {
      setFormError(linkCheck.error);
      return;
    }

    const pinned = Boolean(form.pinned);
    const published = Boolean(form.published);
    const now = Date.now();

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "notices", editingId), {
          title,
          body,
          category: form.category,
          noticeDate,
          link: linkCheck.value || deleteField(),
          pinned,
          published,
          updatedAt: now,
        });
      } else {
        const payload: Record<string, string | boolean | number> = {
          title,
          body,
          category: form.category,
          noticeDate,
          pinned,
          published,
          createdAt: now,
          updatedAt: now,
        };
        if (linkCheck.value) payload.link = linkCheck.value;
        await addDoc(collection(db, "notices"), payload);
      }
      setModalOpen(false);
      await fetchNotices();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save notice."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (notice: Notice, field: "pinned" | "published") => {
    const nextVal = !Boolean(notice[field]);
    const pinned = field === "pinned" ? nextVal : Boolean(notice.pinned);
    const published = field === "published" ? nextVal : Boolean(notice.published);
    const link = String(notice.link ?? "").trim();
    const updatedAt = Date.now();
    try {
      await updateDoc(doc(db, "notices", notice.id), {
        title: String(notice.title ?? "").trim(),
        body: String(notice.body ?? "").trim(),
        category: NOTICE_CATEGORIES.includes(notice.category)
          ? notice.category
          : "general",
        noticeDate: String(notice.noticeDate ?? "").trim(),
        link: link || deleteField(),
        pinned,
        published,
        updatedAt,
      });
      setNotices((prev) =>
        prev.map((n) =>
          n.id === notice.id
            ? { ...n, pinned, published, updatedAt }
            : n
        )
      );
    } catch (err) {
      setError(getErrorMessage(err, `Failed to update ${field} state.`));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "notices", deleteTarget.id));
      setNotices((prev) => prev.filter((n) => n.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete notice."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
            Notices
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Publish department and club notices. Pinned notices appear first on the public site.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm px-5 py-2.5 shadow-sm hover:brightness-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Notice
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
          Loading notices…
        </div>
      ) : sortedNotices.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-500">
          No notices found.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedNotices.map((notice) => (
            <div
              key={notice.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-base text-[#08090B]">
                    {notice.title}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize bg-slate-100 text-slate-700">
                    {notice.category}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {notice.noticeDate}
                  </span>
                  {notice.pinned && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#D7FF3D] text-[#08090B]">
                      <Pin className="w-3 h-3" aria-hidden="true" />
                      Pinned
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      notice.published
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {notice.published ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">
                  {notice.body}
                </p>
                {notice.link && (
                  <p className="text-xs font-mono text-slate-400">
                    Link: {notice.link}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggle(notice, "pinned")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    notice.pinned
                      ? "bg-[#D7FF3D] border-[#08090B]/20 text-[#08090B]"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {notice.pinned ? "Pinned" : "Pin"}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggle(notice, "published")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    notice.published
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {notice.published ? "Published" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(notice)}
                  aria-label={`Edit ${notice.title}`}
                  className="p-2 rounded-xl bg-slate-100 text-[#08090B] hover:bg-[#D7FF3D] transition-colors cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(notice)}
                  aria-label={`Delete ${notice.title}`}
                  className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Notice" : "Add Notice"}
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
              htmlFor="notice-title"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Title *
            </label>
            <input
              id="notice-title"
              type="text"
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Notice headline"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="notice-category"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Category *
              </label>
              <select
                id="notice-category"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as NoticeCategory })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm capitalize text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              >
                {NOTICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="notice-date"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Notice Date *
              </label>
              <input
                id="notice-date"
                type="date"
                required
                value={form.noticeDate}
                onChange={(e) =>
                  setForm({ ...form, noticeDate: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="notice-body"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Body * (max 1000 chars)
            </label>
            <textarea
              id="notice-body"
              required
              rows={5}
              maxLength={1000}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Write the notice details…"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div>
            <label
              htmlFor="notice-link"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Link (optional)
            </label>
            <input
              id="notice-link"
              type="text"
              maxLength={300}
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="alumni.html or https://…"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div className="flex flex-wrap gap-6 pt-1">
            <label className="inline-flex items-center gap-2.5 text-sm font-medium text-[#08090B] cursor-pointer">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="w-4 h-4 accent-[#08090B]"
              />
              Pinned (shown first)
            </label>
            <label className="inline-flex items-center gap-2.5 text-sm font-medium text-[#08090B] cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) =>
                  setForm({ ...form, published: e.target.checked })
                }
                className="w-4 h-4 accent-[#08090B]"
              />
              Published
            </label>
          </div>

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
              {saving ? "Saving…" : editingId ? "Save Changes" : "Create Notice"}
            </button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete notice"
        message={
          deleteTarget ? `Permanently delete "${deleteTarget.title}"?` : ""
        }
      />
    </div>
  );
}
