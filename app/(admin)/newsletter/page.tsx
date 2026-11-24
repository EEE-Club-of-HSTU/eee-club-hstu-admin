"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  downloadCsv,
  formatTimestamp,
  formatTimestampIso,
  getErrorMessage,
  sortByCreatedAtDesc,
} from "@/lib/format";
import type { NewsletterSubscriber } from "@/lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Download, Newspaper, Search, Trash2 } from "lucide-react";

export default function NewsletterPage() {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<NewsletterSubscriber | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const fetchSubscribers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "newsletter_subscribers"));
      setSubscribers(
        sortByCreatedAtDesc(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as NewsletterSubscriber))
        )
      );
    } catch (err) {
      setError(
        getErrorMessage(err, "Failed to load newsletter subscribers. Check database permissions.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subscribers;
    return subscribers.filter((s) =>
      String(s.email ?? "").toLowerCase().includes(q)
    );
  }, [subscribers, search]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "newsletter_subscribers", deleteTarget.id));
      setSubscribers((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to remove subscriber."));
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = () => {
    downloadCsv(
      "newsletter-subscribers.csv",
      filtered.map((s) => ({
        email: String(s.email ?? ""),
        subscribedAt: formatTimestampIso(s.createdAt),
      }))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
            Newsletter Subscribers
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Subscribers from the footer &ldquo;Pulse&rdquo; signup form.
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-500">
          {filtered.length} subscriber{filtered.length === 1 ? "" : "s"}
        </span>
        <div className="relative w-full sm:w-80">
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            enterKeyHint="search"
            aria-label="Search subscribers"
            placeholder="Filter by email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">
          Loading subscribers…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-500">
          <Newspaper className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
          No newsletter subscribers found.
        </div>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="Newsletter subscribers table"
          className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"
        >
          <table className="w-full text-left border-collapse min-w-[480px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Subscribed Date</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-[#08090B]">
                    {sub.email}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                    {formatTimestamp(sub.createdAt)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(sub)}
                      aria-label={`Remove ${sub.email}`}
                      className="inline-flex items-center p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
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

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Remove subscriber"
        message={
          deleteTarget
            ? `Remove "${deleteTarget.email}" from newsletter subscribers?`
            : ""
        }
      />
    </div>
  );
}
