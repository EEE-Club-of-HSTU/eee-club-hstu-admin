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
  validateMediaUrl,
} from "@/lib/format";
import {
  LEADERSHIP_CATEGORIES,
  type LeadershipCategory,
  type LeadershipMember,
} from "@/lib/types";
import { ModalDialog } from "@/components/modal-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ArrowDown, ArrowUp, Edit2, Plus, Trash2 } from "lucide-react";

const CATEGORY_LABELS: Record<LeadershipCategory, string> = {
  executive: "Executive",
  alumni: "Alumni",
  advisory: "Advisory",
  taskforce: "Taskforce",
};

interface MemberFormState {
  name: string;
  role: string;
  category: LeadershipCategory;
  subtitle: string;
  session: string;
  photoUrl: string;
  order: string;
  published: boolean;
}

function MemberAvatar({
  name,
  photoUrl,
  sizeClass = "w-14 h-14",
}: {
  name: string;
  photoUrl?: string;
  sizeClass?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolved = resolveMediaUrl(photoUrl);
  const showImage = Boolean(resolved && failedSrc !== resolved);

  if (showImage && resolved) {
    return (
      <img
        src={resolved}
        alt={name}
        onError={() => setFailedSrc(resolved)}
        className={`${sizeClass} rounded-2xl object-cover border border-slate-200 bg-slate-100 shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-2xl bg-[#08090B] text-[#D7FF3D] font-bold text-sm flex items-center justify-center shrink-0 select-none`}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}

export default function LeadershipPage() {
  const [members, setMembers] = useState<LeadershipMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LeadershipCategory>("executive");
  const [reordering, setReordering] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberFormState>({
    name: "",
    role: "",
    category: "executive",
    subtitle: "",
    session: "",
    photoUrl: "",
    order: "0",
    published: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<LeadershipMember | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "leadership_members"));
      setMembers(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeadershipMember))
      );
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Failed to load leadership members. Check database permissions."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const byCategory = useMemo(() => {
    const grouped: Record<LeadershipCategory, LeadershipMember[]> = {
      executive: [],
      alumni: [],
      advisory: [],
      taskforce: [],
    };
    for (const m of members) {
      const cat = LEADERSHIP_CATEGORIES.includes(m.category)
        ? m.category
        : "executive";
      grouped[cat].push(m);
    }
    for (const cat of LEADERSHIP_CATEGORIES) {
      grouped[cat].sort((a, b) => {
        const orderDiff = (a.order ?? 0) - (b.order ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return (
          (getTimestampMs(a.createdAt) ?? 0) -
          (getTimestampMs(b.createdAt) ?? 0)
        );
      });
    }
    return grouped;
  }, [members]);

  const activeList = byCategory[activeTab];

  const openCreate = () => {
    const nextOrder = byCategory[activeTab].length;
    setEditingId(null);
    setForm({
      name: "",
      role: "",
      category: activeTab,
      subtitle: "",
      session: activeTab === "executive" || activeTab === "taskforce" ? "2026-27" : "",
      photoUrl: "",
      order: String(nextOrder),
      published: true,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (member: LeadershipMember) => {
    setEditingId(member.id);
    setForm({
      name: String(member.name ?? ""),
      role: String(member.role ?? ""),
      category: LEADERSHIP_CATEGORIES.includes(member.category)
        ? member.category
        : activeTab,
      subtitle: String(member.subtitle ?? ""),
      session: String(member.session ?? ""),
      photoUrl: String(member.photoUrl ?? ""),
      order: String(Number.isInteger(member.order) ? member.order : 0),
      published: Boolean(member.published),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = form.name.trim();
    const role = form.role.trim();
    const subtitle = form.subtitle.trim();
    const session = form.session.trim();
    const orderNum = Number(form.order.trim());

    if (!name || name.length > 160) {
      setFormError("Name is required and must be 160 characters or fewer.");
      return;
    }
    if (!role || role.length > 120) {
      setFormError("Role is required and must be 120 characters or fewer.");
      return;
    }
    if (!LEADERSHIP_CATEGORIES.includes(form.category)) {
      setFormError("Select a valid category.");
      return;
    }
    if (subtitle.length > 160) {
      setFormError("Subtitle must be 160 characters or fewer.");
      return;
    }
    if (session.length > 20) {
      setFormError("Session must be 20 characters or fewer.");
      return;
    }
    if (!isValidInt(orderNum)) {
      setFormError("Order must be a non-negative integer.");
      return;
    }

    const photoCheck = validateMediaUrl(form.photoUrl, { label: "Photo URL" });
    if (!photoCheck.ok) {
      setFormError(photoCheck.error);
      return;
    }

    const published = Boolean(form.published);
    const now = Date.now();

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "leadership_members", editingId), {
          name,
          role,
          category: form.category,
          subtitle: subtitle || deleteField(),
          session: session || deleteField(),
          photoUrl: photoCheck.value || deleteField(),
          order: orderNum,
          published,
          updatedAt: now,
        });
      } else {
        const payload: Record<string, string | number | boolean> = {
          name,
          role,
          category: form.category,
          order: orderNum,
          published,
          createdAt: now,
          updatedAt: now,
        };
        if (subtitle) payload.subtitle = subtitle;
        if (session) payload.session = session;
        if (photoCheck.value) payload.photoUrl = photoCheck.value;
        await addDoc(collection(db, "leadership_members"), payload);
      }
      setActiveTab(form.category);
      setModalOpen(false);
      await fetchMembers();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save member."));
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (member: LeadershipMember) => {
    const published = !Boolean(member.published);
    try {
      const updatedAt = await setFlags("leadership_members", member.id, { published });
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, published, updatedAt } : m
        )
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update published state."));
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (
      reordering ||
      targetIndex < 0 ||
      targetIndex >= activeList.length
    ) {
      return;
    }

    setReordering(true);
    setError(null);
    try {
      const { orders, updatedAt } = await moveInOrder(
        "leadership_members",
        activeList.map((m) => m.id),
        index,
        direction
      );
      setMembers((prev) =>
        prev.map((m) =>
          orders.has(m.id) ? { ...m, order: orders.get(m.id)!, updatedAt } : m
        )
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reorder members."));
    } finally {
      setReordering(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "leadership_members", deleteTarget.id));
      setMembers((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete member."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
            Leadership
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage Executive, Alumni, Advisory, and Taskforce profiles and display order.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm px-5 py-2.5 shadow-sm hover:brightness-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Member
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Leadership categories"
        className="flex items-center gap-2 overflow-x-auto flex-nowrap border-b border-slate-200 pb-0"
      >
        {LEADERSHIP_CATEGORIES.map((cat) => {
          const isSelected = activeTab === cat;
          const count = byCategory[cat].length;
          return (
            <button
              key={cat}
              id={`tab-${cat}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveTab(cat)}
              className={`shrink-0 px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                isSelected
                  ? "border-[#08090B] text-[#08090B] bg-[#D7FF3D]/25 rounded-t-xl"
                  : "border-transparent text-slate-500 hover:text-[#08090B]"
              }`}
            >
              {CATEGORY_LABELS[cat]}{" "}
              <span className="ml-1 text-xs font-mono text-slate-500">
                ({count})
              </span>
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

      <div
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        className="outline-none"
      >
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">
            Loading leadership members…
          </div>
        ) : activeList.length === 0 ? (
          <div className="py-16 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-500">
            No {CATEGORY_LABELS[activeTab].toLowerCase()} members yet.
          </div>
        ) : (
          <div className="space-y-3">
            {activeList.map((member, index) => (
              <div
                key={member.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <MemberAvatar
                    name={member.name}
                    photoUrl={member.photoUrl}
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">
                        #{member.order}
                      </span>
                      <h2 className="font-bold text-base text-[#08090B] truncate">
                        {member.name}
                      </h2>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          member.published
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {member.published ? "Published" : "Draft"}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      {member.role}
                      {member.session ? ` · ${member.session}` : ""}
                    </p>
                    {(member.subtitle || member.photoUrl) && (
                      <p className="text-xs text-slate-500 truncate">
                        {[member.subtitle, member.photoUrl]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={reordering || index === 0}
                    onClick={() => handleMove(index, -1)}
                    aria-label={`Move ${member.name} up`}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                  >
                    <ArrowUp className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={reordering || index === activeList.length - 1}
                    onClick={() => handleMove(index, 1)}
                    aria-label={`Move ${member.name} down`}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                  >
                    <ArrowDown className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePublished(member)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      member.published
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {member.published ? "Published" : "Publish"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(member)}
                    aria-label={`Edit ${member.name}`}
                    className="p-2 rounded-xl bg-slate-100 text-[#08090B] hover:bg-[#D7FF3D] transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(member)}
                    aria-label={`Delete ${member.name}`}
                    className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Member" : "Add Member"}
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
            <MemberAvatar
              name={form.name || "Member"}
              photoUrl={form.photoUrl}
              sizeClass="w-16 h-16"
            />
            <div className="min-w-0 text-xs text-slate-500">
              <p className="font-semibold text-[#08090B]">Photo preview</p>
              <p className="mt-0.5 break-all">
                {resolveMediaUrl(form.photoUrl)
                  ? "Loaded from URL"
                  : form.photoUrl.trim()
                  ? "Relative path — set NEXT_PUBLIC_SITE_URL to preview images, or initials will show here."
                  : "No photo URL — public site shows an initials tile."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="member-name"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Name *
              </label>
              <input
                id="member-name"
                type="text"
                required
                maxLength={160}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Prof. Dr. Md. Zamil Sultan"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="member-role"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Role *
              </label>
              <input
                id="member-role"
                type="text"
                required
                maxLength={120}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="General Secretary"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="member-category"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Category *
              </label>
              <select
                id="member-category"
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value as LeadershipCategory,
                  })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              >
                {LEADERSHIP_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="member-session"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Session
              </label>
              <input
                id="member-session"
                type="text"
                maxLength={20}
                value={form.session}
                onChange={(e) => setForm({ ...form, session: e.target.value })}
                placeholder="2026-27"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="member-order"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Order *
              </label>
              <input
                id="member-order"
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
              htmlFor="member-subtitle"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Subtitle (optional)
            </label>
            <input
              id="member-subtitle"
              type="text"
              maxLength={160}
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              placeholder="Level 3 · Semester 2 or Batch 2019 · Power systems engineer"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div>
            <label
              htmlFor="member-photo"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Photo URL (optional, https:// or site path)
            </label>
            <input
              id="member-photo"
              type="text"
              maxLength={500}
              value={form.photoUrl}
              onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
              placeholder="assets/advisory/19.jpg or https://…"
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
              {saving ? "Saving…" : editingId ? "Save Changes" : "Add Member"}
            </button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete member"
        message={
          deleteTarget
            ? `Permanently delete "${deleteTarget.name}" (${deleteTarget.role})?`
            : ""
        }
      />
    </div>
  );
}
