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
  getInitials,
  getTimestampMs,
  resolveMediaUrl,
  safeExternalHref,
  validateHttpsUrl,
  validateMediaUrl,
} from "@/lib/format";
import type { PartnerItem } from "@/lib/types";
import { ModalDialog } from "@/components/modal-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  ArrowDown,
  ArrowUp,
  Edit2,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";

interface PartnerFormState {
  name: string;
  category: string;
  logoUrl: string;
  website: string;
  order: string;
  published: boolean;
}

function PartnerLogo({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolved = resolveMediaUrl(logoUrl);
  const showImage = Boolean(resolved && failedSrc !== resolved);

  if (showImage && resolved) {
    return (
      <div className="w-16 h-14 rounded-2xl border border-slate-200 bg-white p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
        <img
          src={resolved}
          alt={name}
          onError={() => setFailedSrc(resolved)}
          className="max-w-full max-h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className="w-16 h-14 rounded-2xl bg-[#08090B] text-[#D7FF3D] font-bold text-xs flex items-center justify-center shrink-0 px-1 text-center"
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerFormState>({
    name: "",
    category: "",
    logoUrl: "",
    website: "",
    order: "0",
    published: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PartnerItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "partners"));
      setPartners(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as PartnerItem))
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to load partners. Check database permissions."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const sortedPartners = useMemo(() => {
    return [...partners].sort((a, b) => {
      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return (
        (getTimestampMs(a.createdAt) ?? 0) - (getTimestampMs(b.createdAt) ?? 0)
      );
    });
  }, [partners]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      name: "",
      category: "",
      logoUrl: "",
      website: "",
      order: String(sortedPartners.length),
      published: true,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (item: PartnerItem) => {
    setEditingId(item.id);
    setForm({
      name: String(item.name ?? ""),
      category: String(item.category ?? ""),
      logoUrl: String(item.logoUrl ?? ""),
      website: String(item.website ?? ""),
      order: String(Number.isInteger(item.order) ? item.order : 0),
      published: Boolean(item.published),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = form.name.trim();
    const category = form.category.trim();
    const orderNum = Number(form.order.trim());

    if (!name || name.length > 160) {
      setFormError("Name is required and must be 160 characters or fewer.");
      return;
    }
    if (category.length > 80) {
      setFormError("Category must be 80 characters or fewer.");
      return;
    }
    if (!isValidInt(orderNum)) {
      setFormError("Order must be a non-negative integer.");
      return;
    }

    const logoCheck = validateMediaUrl(form.logoUrl, { label: "Logo URL" });
    if (!logoCheck.ok) {
      setFormError(logoCheck.error);
      return;
    }

    const websiteCheck = validateHttpsUrl(form.website, {
      label: "Website URL",
    });
    if (!websiteCheck.ok) {
      setFormError(websiteCheck.error);
      return;
    }

    const published = Boolean(form.published);
    const now = Date.now();

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "partners", editingId), {
          name,
          category: category || deleteField(),
          logoUrl: logoCheck.value || deleteField(),
          website: websiteCheck.value || deleteField(),
          order: orderNum,
          published,
          updatedAt: now,
        });
      } else {
        const payload: Record<string, string | number | boolean> = {
          name,
          order: orderNum,
          published,
          createdAt: now,
          updatedAt: now,
        };
        if (category) payload.category = category;
        if (logoCheck.value) payload.logoUrl = logoCheck.value;
        if (websiteCheck.value) payload.website = websiteCheck.value;
        await addDoc(collection(db, "partners"), payload);
      }
      setModalOpen(false);
      await fetchPartners();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save partner."));
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (item: PartnerItem) => {
    const published = !Boolean(item.published);
    try {
      const updatedAt = await setFlags("partners", item.id, { published });
      setPartners((prev) =>
        prev.map((p) =>
          p.id === item.id ? { ...p, published, updatedAt } : p
        )
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update published state."));
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (reordering || target < 0 || target >= sortedPartners.length) return;

    setReordering(true);
    setError(null);
    try {
      const { orders, updatedAt } = await moveInOrder(
        "partners",
        sortedPartners.map((p) => p.id),
        index,
        direction
      );
      setPartners((prev) =>
        prev.map((p) =>
          orders.has(p.id) ? { ...p, order: orders.get(p.id)!, updatedAt } : p
        )
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reorder partners."));
    } finally {
      setReordering(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "partners", deleteTarget.id));
      setPartners((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete partner."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
            Partners
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage academic, industry, and event sponsors with logo previews and ordering.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm px-5 py-2.5 shadow-sm hover:brightness-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Partner
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
          Loading partners…
        </div>
      ) : sortedPartners.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-500">
          No partners configured yet. When empty, the public site shows its built-in partner list.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedPartners.map((partner, idx) => {
            const safeSite = safeExternalHref(partner.website, {
              httpsOnly: true,
            });
            return (
              <div
                key={partner.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <PartnerLogo name={partner.name} logoUrl={partner.logoUrl} />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">
                        #{partner.order}
                      </span>
                      <h2 className="font-bold text-base text-[#08090B]">
                        {partner.name}
                      </h2>
                      {partner.category && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {partner.category}
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          partner.published
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {partner.published ? "Published" : "Draft"}
                      </span>
                    </div>
                    {safeSite && (
                      <a
                        href={safeSite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-mono text-slate-500 hover:text-[#08090B] hover:underline"
                      >
                        {safeSite}
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={reordering || idx === 0}
                    onClick={() => handleMove(idx, -1)}
                    aria-label={`Move ${partner.name} up`}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                  >
                    <ArrowUp className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={reordering || idx === sortedPartners.length - 1}
                    onClick={() => handleMove(idx, 1)}
                    aria-label={`Move ${partner.name} down`}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                  >
                    <ArrowDown className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePublished(partner)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      partner.published
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {partner.published ? "Published" : "Publish"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(partner)}
                    aria-label={`Edit ${partner.name}`}
                    className="p-2 rounded-xl bg-slate-100 text-[#08090B] hover:bg-[#D7FF3D] transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(partner)}
                    aria-label={`Delete ${partner.name}`}
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
        title={editingId ? "Edit Partner" : "Add Partner"}
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

          <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <PartnerLogo
              name={form.name || "Partner"}
              logoUrl={form.logoUrl}
            />
            <div className="min-w-0 text-xs text-slate-500">
              <p className="font-semibold text-[#08090B]">Logo preview</p>
              <p className="mt-0.5">
                {resolveMediaUrl(form.logoUrl)
                  ? "Loaded from URL"
                  : form.logoUrl.trim()
                  ? "Relative path — set NEXT_PUBLIC_SITE_URL to preview."
                  : "No logo URL — public site displays the partner name as a wordmark."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="partner-name"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Name * (max 160)
              </label>
              <input
                id="partner-name"
                type="text"
                required
                maxLength={160}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="IEEE HSTU Student Branch"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="partner-order"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Order *
              </label>
              <input
                id="partner-order"
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

          <div>
            <label
              htmlFor="partner-category"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Category (optional, max 80)
            </label>
            <input
              id="partner-category"
              type="text"
              maxLength={80}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Academic partner"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div>
            <label
              htmlFor="partner-logo"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Logo URL (optional, https:// or site path)
            </label>
            <input
              id="partner-logo"
              type="text"
              maxLength={500}
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="https://… or assets/partners/logo.png"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div>
            <label
              htmlFor="partner-website"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Website (optional, https:// only)
            </label>
            <input
              id="partner-website"
              type="url"
              maxLength={500}
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://…"
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
              {saving ? "Saving…" : editingId ? "Save Changes" : "Add Partner"}
            </button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete partner"
        message={
          deleteTarget ? `Permanently delete "${deleteTarget.name}"?` : ""
        }
      />
    </div>
  );
}
