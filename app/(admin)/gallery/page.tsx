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
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isValidInt } from "@/lib/format";
import { setFlags, moveInOrder } from "@/lib/ordering";
import {
  getErrorMessage,
  getTimestampMs,
  resolveMediaUrl,
  validateMediaUrl,
} from "@/lib/format";
import {
  GALLERY_CATEGORIES,
  type GalleryCategory,
  type GalleryItem,
} from "@/lib/types";
import { ModalDialog } from "@/components/modal-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  ArrowDown,
  ArrowUp,
  Edit2,
  Image as ImageIcon,
  Plus,
  Trash2,
} from "lucide-react";

interface GalleryFormState {
  title: string;
  imageUrl: string;
  category: GalleryCategory;
  takenOn: string;
  order: string;
  published: boolean;
}

function GalleryThumb({
  imageUrl,
  title,
  heightClass = "aspect-[16/10]",
}: {
  imageUrl: string;
  title: string;
  heightClass?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolved = resolveMediaUrl(imageUrl);
  const showImage = Boolean(resolved && failedSrc !== resolved);

  return (
    <div
      className={`${heightClass} w-full rounded-xl border border-slate-200 bg-slate-100 overflow-hidden flex flex-col items-center justify-center text-slate-400`}
    >
      {showImage && resolved ? (
        <img
          src={resolved}
          alt={title}
          onError={() => setFailedSrc(resolved)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="px-3 text-center space-y-1">
          <ImageIcon className="w-6 h-6 mx-auto opacity-60" aria-hidden="true" />
          <p className="text-[11px] font-mono break-all line-clamp-2">
            {imageUrl || "No image URL"}
          </p>
        </div>
      )}
    </div>
  );
}

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | GalleryCategory>(
    "all"
  );
  const [reordering, setReordering] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GalleryFormState>({
    title: "",
    imageUrl: "",
    category: "competition",
    takenOn: "",
    order: "0",
    published: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<GalleryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "gallery_items"));
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryItem)));
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to load gallery items. Check database permissions."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const sortedAll = useMemo(() => {
    return [...items].sort((a, b) => {
      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return (
        (getTimestampMs(a.createdAt) ?? 0) - (getTimestampMs(b.createdAt) ?? 0)
      );
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    if (categoryFilter === "all") return sortedAll;
    return sortedAll.filter((item) => item.category === categoryFilter);
  }, [sortedAll, categoryFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      title: "",
      imageUrl: "",
      category: categoryFilter === "all" ? "competition" : categoryFilter,
      takenOn: "",
      order: String(sortedAll.length),
      published: true,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (item: GalleryItem) => {
    setEditingId(item.id);
    setForm({
      title: String(item.title ?? ""),
      imageUrl: String(item.imageUrl ?? ""),
      category: GALLERY_CATEGORIES.includes(item.category)
        ? item.category
        : "other",
      takenOn: String(item.takenOn ?? ""),
      order: String(Number.isInteger(item.order) ? item.order : 0),
      published: Boolean(item.published),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const title = form.title.trim();
    const takenOn = form.takenOn.trim();
    const orderNum = Number(form.order.trim());

    if (!title || title.length > 160) {
      setFormError("Caption is required and must be 160 characters or fewer.");
      return;
    }
    if (!GALLERY_CATEGORIES.includes(form.category)) {
      setFormError("Select a valid category.");
      return;
    }
    if (takenOn && !/^\d{4}-\d{2}$/.test(takenOn)) {
      setFormError("Taken On must use YYYY-MM format (e.g. 2026-11).");
      return;
    }
    if (!isValidInt(orderNum)) {
      setFormError("Order must be a non-negative integer.");
      return;
    }

    const imageCheck = validateMediaUrl(form.imageUrl, {
      required: true,
      label: "Image URL",
    });
    if (!imageCheck.ok) {
      setFormError(imageCheck.error);
      return;
    }

    const published = Boolean(form.published);
    const now = Date.now();

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "gallery_items", editingId), {
          title,
          imageUrl: imageCheck.value,
          category: form.category,
          takenOn: takenOn || deleteField(),
          order: orderNum,
          published,
          updatedAt: now,
        });
      } else {
        const payload: Record<string, string | number | boolean> = {
          title,
          imageUrl: imageCheck.value,
          category: form.category,
          order: orderNum,
          published,
          createdAt: now,
          updatedAt: now,
        };
        if (takenOn) payload.takenOn = takenOn;
        await addDoc(collection(db, "gallery_items"), payload);
      }
      setModalOpen(false);
      await fetchItems();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save gallery item."));
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (item: GalleryItem) => {
    const published = !Boolean(item.published);
    try {
      const updatedAt = await setFlags("gallery_items", item.id, { published });
      setItems((prev) =>
        prev.map((g) => (g.id === item.id ? { ...g, published, updatedAt } : g))
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update published state."));
    }
  };

  const handleMove = async (visibleIndex: number, direction: -1 | 1) => {
    const neighborIndex = visibleIndex + direction;
    if (
      reordering ||
      neighborIndex < 0 ||
      neighborIndex >= filteredItems.length
    ) {
      return;
    }

    setReordering(true);
    setError(null);
    try {
      // Reorder within the visible (filtered) list only.
      const { orders, updatedAt } = await moveInOrder(
        "gallery_items",
        filteredItems.map((g) => g.id),
        visibleIndex,
        direction
      );
      setItems((prev) =>
        prev.map((g) =>
          orders.has(g.id) ? { ...g, order: orders.get(g.id)!, updatedAt } : g
        )
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reorder gallery items."));
    } finally {
      setReordering(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "gallery_items", deleteTarget.id));
      setItems((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete gallery item."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
            Gallery
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Curate photo thumbnails, categories, captions, and display order using image URLs.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm px-5 py-2.5 shadow-sm hover:brightness-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Photo
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
        <button
          type="button"
          onClick={() => setCategoryFilter("all")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
            categoryFilter === "all"
              ? "bg-[#08090B] text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All ({items.length})
        </button>
        {GALLERY_CATEGORIES.map((cat) => {
          const count = items.filter((g) => g.category === cat).length;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? "bg-[#D7FF3D] text-[#08090B] ring-1 ring-[#08090B]/20"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
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
          Loading gallery…
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-500">
          {items.length === 0
            ? "No gallery items yet. Add your first photo URL."
            : "No gallery items in this category."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredItems.map((item, idx) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3 hover:border-slate-300 transition-colors"
            >
              <GalleryThumb imageUrl={item.imageUrl} title={item.title} />

              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">
                    #{item.order}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize bg-slate-100 text-slate-700">
                    {item.category}
                  </span>
                  {item.takenOn && (
                    <span className="text-xs font-mono text-slate-500">
                      {item.takenOn}
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      item.published
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {item.published ? "Published" : "Draft"}
                  </span>
                </div>
                <h2 className="font-bold text-sm text-[#08090B] leading-snug">
                  {item.title}
                </h2>
                <p className="text-[11px] font-mono text-slate-400 truncate">
                  {item.imageUrl}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={reordering || idx === 0}
                    onClick={() => handleMove(idx, -1)}
                    aria-label={`Move ${item.title} earlier`}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                  >
                    <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={reordering || idx === filteredItems.length - 1}
                    onClick={() => handleMove(idx, 1)}
                    aria-label={`Move ${item.title} later`}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                  >
                    <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleTogglePublished(item)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      item.published
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {item.published ? "Published" : "Publish"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    aria-label={`Edit ${item.title}`}
                    className="p-2 rounded-xl bg-slate-100 text-[#08090B] hover:bg-[#D7FF3D] transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    aria-label={`Delete ${item.title}`}
                    className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Photo" : "Add Photo"}
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

          <GalleryThumb
            imageUrl={form.imageUrl}
            title={form.title || "Preview"}
            heightClass="h-44"
          />

          <div>
            <label
              htmlFor="gallery-title"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Caption / Title * (max 160)
            </label>
            <input
              id="gallery-title"
              type="text"
              required
              maxLength={160}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Volt Rush 2026 finals at TSC Auditorium"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div>
            <label
              htmlFor="gallery-url"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Image URL * (https:// or site path)
            </label>
            <input
              id="gallery-url"
              type="text"
              required
              maxLength={500}
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://… or assets/gallery/volt-rush.jpg"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="gallery-category"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Category *
              </label>
              <select
                id="gallery-category"
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value as GalleryCategory,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm capitalize text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              >
                {GALLERY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="gallery-taken-on"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Taken On (YYYY-MM)
              </label>
              <input
                id="gallery-taken-on"
                type="month"
                value={form.takenOn}
                onChange={(e) => setForm({ ...form, takenOn: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="gallery-order"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Order *
              </label>
              <input
                id="gallery-order"
                type="number"
                required
                min={0}
                step={1}
                value={form.order}
                onChange={(e) => setForm({ ...form, order: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
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
              {saving ? "Saving…" : editingId ? "Save Changes" : "Add Photo"}
            </button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete gallery photo"
        message={
          deleteTarget ? `Permanently delete "${deleteTarget.title}"?` : ""
        }
      />
    </div>
  );
}
