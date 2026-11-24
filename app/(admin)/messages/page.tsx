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
  formatTimestamp,
  getErrorMessage,
  sortByCreatedAtDesc,
} from "@/lib/format";
import type { ContactMessage, MessageStatus } from "@/lib/types";
import { ModalDialog } from "@/components/modal-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Archive, Mail, Reply, Trash2 } from "lucide-react";

type FilterTab = MessageStatus | "all";

export default function MessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("new");
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContactMessage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "contact_messages"));
      setMessages(
        sortByCreatedAtDesc(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactMessage))
        )
      );
    } catch (err) {
      setError(
        getErrorMessage(err, "Failed to load contact messages. Check database permissions.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const counts = useMemo(
    () => ({
      new: messages.filter((m) => m.status === "new").length,
      read: messages.filter((m) => m.status === "read").length,
      archived: messages.filter((m) => m.status === "archived").length,
      all: messages.length,
    }),
    [messages]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return messages;
    return messages.filter((m) => m.status === filter);
  }, [messages, filter]);

  const handleOpenMessage = async (msg: ContactMessage) => {
    setSelected(msg);
    if (msg.status === "new") {
      try {
        await updateDoc(doc(db, "contact_messages", msg.id), { status: "read" });
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, status: "read" } : m))
        );
        setSelected({ ...msg, status: "read" });
      } catch (err) {
        setError(getErrorMessage(err, "Failed to mark message as read."));
      }
    }
  };

  const handleSetStatus = async (msg: ContactMessage, status: MessageStatus) => {
    setUpdating(true);
    setError(null);
    try {
      await updateDoc(doc(db, "contact_messages", msg.id), { status });
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status } : m))
      );
      setSelected((prev) => (prev && prev.id === msg.id ? { ...prev, status } : prev));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update message status."));
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "contact_messages", deleteTarget.id));
      setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete message."));
    } finally {
      setDeleting(false);
    }
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "new", label: "New", count: counts.new },
    { key: "read", label: "Read", count: counts.read },
    { key: "archived", label: "Archived", count: counts.archived },
    { key: "all", label: "All", count: counts.all },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
          Contact Messages
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Inbox for inquiries submitted through the public website contact form.
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

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter messages">
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

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">
          Loading messages…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-500">
          <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
          No messages in this view.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {filtered.map((msg) => (
            <li
              key={msg.id}
              onClick={() => handleOpenMessage(msg)}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 cursor-pointer transition-colors ${
                msg.status === "new" ? "bg-[#D7FF3D]/15 hover:bg-[#D7FF3D]/25" : "hover:bg-slate-50"
              }`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm text-[#08090B]">
                    {msg.name}
                  </span>
                  <span className="text-xs text-slate-500">{msg.email}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize bg-slate-100 text-slate-700">
                    {msg.topic}
                  </span>
                  <MessageStatusBadge status={msg.status} />
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{msg.message}</p>
              </div>

              <div
                className="flex items-center gap-2 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-xs text-slate-400 mr-2">
                  {formatTimestamp(msg.createdAt)}
                </span>
                {msg.status !== "archived" && (
                  <button
                    type="button"
                    onClick={() => handleSetStatus(msg, "archived")}
                    title="Archive message"
                    aria-label={`Archive message from ${msg.name}`}
                    className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-[#08090B] cursor-pointer"
                  >
                    <Archive className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDeleteTarget(msg)}
                  title="Delete message"
                  aria-label={`Delete message from ${msg.name}`}
                  className="p-2 rounded-xl text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ModalDialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `Message from ${selected.name}` : "Message"}
        maxWidthClass="max-w-xl"
      >
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  From
                </span>
                <p className="font-semibold text-[#08090B]">{selected.name}</p>
                <p className="text-xs text-slate-500">{selected.email}</p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Topic & Organization
                </span>
                <p className="font-medium capitalize text-[#08090B]">
                  {selected.topic}
                </p>
                <p className="text-xs text-slate-500">
                  {selected.organization || "No organization"}
                </p>
              </div>
              <div className="sm:col-span-2 flex items-center justify-between text-xs text-slate-500">
                <span>Received {formatTimestamp(selected.createdAt)}</span>
                <MessageStatusBadge status={selected.status} />
              </div>
            </div>

            <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 border border-slate-200 p-4 text-slate-800 leading-relaxed">
              {selected.message}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => setDeleteTarget(selected)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-red-50 text-red-700 font-semibold text-xs hover:bg-red-100 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  Delete
                </button>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() =>
                    handleSetStatus(
                      selected,
                      selected.status === "archived" ? "read" : "archived"
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  <Archive className="w-4 h-4" aria-hidden="true" />
                  {selected.status === "archived" ? "Move to Read" : "Archive"}
                </button>
              </div>

              <a
                href={`mailto:${String(selected.email ?? "")}?subject=${encodeURIComponent(
                  `Re: EEE Club of HSTU — ${String(selected.topic ?? "")}`
                )}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm hover:brightness-95 transition-all"
              >
                <Reply className="w-4 h-4" aria-hidden="true" />
                Reply by email
              </a>
            </div>
          </div>
        )}
      </ModalDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete message"
        message={
          deleteTarget
            ? `Permanently delete the message from "${deleteTarget.name}"?`
            : ""
        }
      />
    </div>
  );
}

function MessageStatusBadge({ status }: { status: MessageStatus }) {
  const styles: Record<MessageStatus, string> = {
    new: "bg-[#D7FF3D] text-[#08090B] border-[#08090B]/15",
    read: "bg-slate-100 text-slate-600 border-slate-200",
    archived: "bg-slate-50 text-slate-400 border-slate-200",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize border ${
        styles[status] || "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {status}
    </span>
  );
}
