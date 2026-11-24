"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  downloadCsv,
  formatTimestamp,
  formatTimestampIso,
  getErrorMessage,
  safeExternalHref,
  sortByCreatedAtDesc,
} from "@/lib/format";
import type { AlumniRegistration, AlumniStatus } from "@/lib/types";
import { ModalDialog } from "@/components/modal-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

type FilterTab = AlumniStatus | "all";

export default function AlumniPage() {
  const [items, setItems] = useState<AlumniRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AlumniRegistration | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AlumniRegistration | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAlumni = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "alumni_registrations"));
      setItems(
        sortByCreatedAtDesc(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as AlumniRegistration))
        )
      );
    } catch (err) {
      setError(
        getErrorMessage(err, "Failed to load alumni registrations. Check database permissions.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlumni();
  }, [fetchAlumni]);

  const counts = useMemo(
    () => ({
      pending: items.filter((i) => i.status === "pending").length,
      approved: items.filter((i) => i.status === "approved").length,
      rejected: items.filter((i) => i.status === "rejected").length,
      all: items.length,
    }),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      if (!q) return true;
      return (
        String(item.fullName ?? "").toLowerCase().includes(q) ||
        String(item.email ?? "").toLowerCase().includes(q) ||
        String(item.organization ?? "").toLowerCase().includes(q) ||
        String(item.session ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, filter, search]);

  const openDetail = (item: AlumniRegistration) => {
    setSelected(item);
    setNoteDraft(String(item.adminNote ?? ""));
  };

  const handleDecision = async (status: "approved" | "rejected") => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const reviewedAt = Date.now();
      const adminNote = noteDraft.trim();
      await updateDoc(doc(db, "alumni_registrations", selected.id), {
        status,
        reviewedAt,
        adminNote,
      });
      setItems((prev) =>
        prev.map((it) =>
          it.id === selected.id ? { ...it, status, reviewedAt, adminNote } : it
        )
      );
      setSelected((prev) =>
        prev ? { ...prev, status, reviewedAt, adminNote } : null
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update registration status."));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "alumni_registrations", deleteTarget.id));
      setItems((prev) => prev.filter((it) => it.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete alumni registration."));
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = () => {
    downloadCsv(
      `alumni-registrations-${filter}.csv`,
      filtered.map((item) => ({
        id: String(item.id ?? ""),
        fullName: String(item.fullName ?? ""),
        session: String(item.session ?? ""),
        graduationYear: item.graduationYear ?? "",
        email: String(item.email ?? ""),
        studentId: String(item.studentId ?? ""),
        phone: String(item.phone ?? ""),
        currentRole: String(item.currentRole ?? ""),
        organization: String(item.organization ?? ""),
        city: String(item.city ?? ""),
        linkedin: String(item.linkedin ?? ""),
        interests: Array.isArray(item.interests)
          ? item.interests.map((i) => String(i ?? "")).join("; ")
          : "",
        message: String(item.message ?? ""),
        consent: Boolean(item.consent),
        status: String(item.status ?? ""),
        source: String(item.source ?? ""),
        createdAt: formatTimestampIso(item.createdAt),
        reviewedAt: formatTimestampIso(item.reviewedAt),
        adminNote: String(item.adminNote ?? ""),
      }))
    );
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "approved", label: "Approved", count: counts.approved },
    { key: "rejected", label: "Rejected", count: counts.rejected },
    { key: "all", label: "All", count: counts.all },
  ];

  const linkedinHref = selected ? safeExternalHref(selected.linkedin) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
            Alumni Registrations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review EEE Alumni Association submissions and export filtered records.
          </p>
        </div>

        <button
          type="button"
          disabled={filtered.length === 0}
          onClick={handleExportCsv}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm px-4 py-2.5 shadow-sm hover:brightness-95 transition-all cursor-pointer disabled:opacity-40"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          Export CSV ({filtered.length})
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

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
          {tabs.map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-[#D7FF3D] text-[#08090B] shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-[#08090B]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-md ${
                    active ? "bg-[#08090B]/10 text-[#08090B]" : "bg-white text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-80">
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            enterKeyHint="search"
            aria-label="Search alumni registrations"
            placeholder="Search name, email, org, session…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">
          Loading alumni registrations…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-500">
          No alumni registrations match the current filter.
        </div>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="Alumni registrations table"
          className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"
        >
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Alumni</th>
                <th className="py-3.5 px-4">Session / Year</th>
                <th className="py-3.5 px-4">Role & Organization</th>
                <th className="py-3.5 px-4">Submitted</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => openDetail(item)}
                  className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-[#08090B]">{item.fullName}</p>
                    <p className="text-xs text-slate-500">{item.email}</p>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                    {item.session} ({item.graduationYear})
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    <p className="truncate max-w-[220px]">
                      {item.currentRole || "—"}
                    </p>
                    <p className="text-xs text-slate-500 truncate max-w-[220px]">
                      {item.organization || ""}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                    {formatTimestamp(item.createdAt)}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <AlumniStatusBadge status={item.status} />
                  </td>
                  <td
                    className="py-3.5 px-4 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => openDetail(item)}
                      className="text-xs font-semibold text-[#08090B] hover:underline mr-3 cursor-pointer"
                    >
                      Inspect
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      aria-label={`Delete ${item.fullName}`}
                      className="inline-flex items-center p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModalDialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? selected.fullName : "Alumni details"}
        maxWidthClass="max-w-2xl"
      >
        {selected && (
          <div className="space-y-6 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlumniStatusBadge status={selected.status} />
                {selected.source && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    Source: {selected.source}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500">
                Submitted {formatTimestamp(selected.createdAt)}
              </span>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailItem label="Full Name" value={selected.fullName} />
              <DetailItem label="Email" value={selected.email} />
              <DetailItem label="Academic Session" value={selected.session} />
              <DetailItem
                label="Graduation Year"
                value={String(selected.graduationYear)}
              />
              <DetailItem label="Student ID" value={selected.studentId || "—"} />
              <DetailItem label="Phone" value={selected.phone || "—"} />
              <DetailItem label="Current Role" value={selected.currentRole || "—"} />
              <DetailItem
                label="Organization"
                value={selected.organization || "—"}
              />
              <DetailItem label="City" value={selected.city || "—"} />
              <DetailItem
                label="Consent Given"
                value={selected.consent ? "Yes" : "No"}
              />
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  LinkedIn
                </dt>
                <dd className="mt-1 text-slate-800 break-all">
                  {linkedinHref ? (
                    <a
                      href={linkedinHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-blue-600 hover:underline font-medium"
                    >
                      {selected.linkedin}
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  ) : (
                    <span>{selected.linkedin || "—"}</span>
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Interests
                </dt>
                <dd className="mt-1.5 flex flex-wrap gap-2">
                  {Array.isArray(selected.interests) && selected.interests.length > 0 ? (
                    selected.interests.map((interest, idx) => {
                      const label = String(interest ?? "").replace(/_/g, " ");
                      return (
                        <span
                          key={`${idx}-${label}`}
                          className="px-2.5 py-1 rounded-full bg-[#D7FF3D]/45 text-[#08090B] text-xs font-semibold"
                        >
                          {label || "—"}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Message
                </dt>
                <dd className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 border border-slate-200 p-3 text-slate-700">
                  {selected.message || "—"}
                </dd>
              </div>
              {selected.reviewedAt && (
                <DetailItem
                  label="Last Reviewed"
                  value={formatTimestamp(selected.reviewedAt)}
                />
              )}
            </dl>

            <div>
              <label
                htmlFor="alumni-admin-note"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Admin Note (optional)
              </label>
              <textarea
                id="alumni-admin-note"
                rows={2}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Internal review note…"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={saving}
                onClick={() => setDeleteTarget(selected)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-50 text-red-700 font-semibold text-xs hover:bg-red-100 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Delete
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleDecision("rejected")}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 bg-white text-red-700 font-semibold text-sm hover:bg-red-50 cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" aria-hidden="true" />
                  Reject
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleDecision("approved")}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm hover:brightness-95 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}
      </ModalDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete alumni registration"
        message={
          deleteTarget
            ? `Permanently delete the alumni registration for "${deleteTarget.fullName}"?`
            : ""
        }
      />
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-[#08090B] font-medium break-words">{value}</dd>
    </div>
  );
}

function AlumniStatusBadge({ status }: { status: AlumniStatus }) {
  const styles: Record<AlumniStatus, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
        styles[status] || "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {status}
    </span>
  );
}
