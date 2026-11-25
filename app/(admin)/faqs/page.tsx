"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isValidInt } from "@/lib/format";
import { setFlags, moveInOrder } from "@/lib/ordering";
import { getErrorMessage, getTimestampMs } from "@/lib/format";
import type { FaqItem } from "@/lib/types";
import { ModalDialog } from "@/components/modal-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ArrowDown, ArrowUp, Edit2, Plus, Trash2 } from "lucide-react";

interface FaqFormState {
  question: string;
  answer: string;
  order: string;
  published: boolean;
}

export default function FaqsPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FaqFormState>({
    question: "",
    answer: "",
    order: "0",
    published: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<FaqItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchFaqs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "faqs"));
      setFaqs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FaqItem)));
    } catch (err) {
      setError(
        getErrorMessage(err, "Failed to load FAQs. Check database permissions.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const sortedFaqs = useMemo(() => {
    return [...faqs].sort((a, b) => {
      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return (
        (getTimestampMs(a.createdAt) ?? 0) - (getTimestampMs(b.createdAt) ?? 0)
      );
    });
  }, [faqs]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      question: "",
      answer: "",
      order: String(sortedFaqs.length),
      published: true,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (item: FaqItem) => {
    setEditingId(item.id);
    setForm({
      question: String(item.question ?? ""),
      answer: String(item.answer ?? ""),
      order: String(Number.isInteger(item.order) ? item.order : 0),
      published: Boolean(item.published),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const question = form.question.trim();
    const answer = form.answer.trim();
    const orderNum = Number(form.order.trim());

    if (!question || question.length > 300) {
      setFormError("Question is required and must be 300 characters or fewer.");
      return;
    }
    if (!answer || answer.length > 3000) {
      setFormError("Answer is required and must be 3000 characters or fewer.");
      return;
    }
    if (!isValidInt(orderNum)) {
      setFormError("Order must be a non-negative integer.");
      return;
    }

    const published = Boolean(form.published);
    const now = Date.now();

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "faqs", editingId), {
          question,
          answer,
          order: orderNum,
          published,
          updatedAt: now,
        });
      } else {
        await addDoc(collection(db, "faqs"), {
          question,
          answer,
          order: orderNum,
          published,
          createdAt: now,
          updatedAt: now,
        });
      }
      setModalOpen(false);
      await fetchFaqs();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save FAQ."));
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (item: FaqItem) => {
    const published = !Boolean(item.published);
    try {
      const updatedAt = await setFlags("faqs", item.id, { published });
      setFaqs((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, published, updatedAt } : f))
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update published state."));
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (reordering || target < 0 || target >= sortedFaqs.length) return;

    setReordering(true);
    setError(null);
    try {
      const { orders, updatedAt } = await moveInOrder(
        "faqs",
        sortedFaqs.map((f) => f.id),
        index,
        direction
      );
      setFaqs((prev) =>
        prev.map((f) =>
          orders.has(f.id) ? { ...f, order: orders.get(f.id)!, updatedAt } : f
        )
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to reorder FAQs."));
    } finally {
      setReordering(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "faqs", deleteTarget.id));
      setFaqs((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete FAQ."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
            FAQs
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage frequently asked questions shown on the Contact page in ascending order.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm px-5 py-2.5 shadow-sm hover:brightness-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add FAQ
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
          Loading FAQs…
        </div>
      ) : sortedFaqs.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-500">
          No FAQs yet. Add a question or load demo content from the dashboard.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedFaqs.map((faq, idx) => (
            <div
              key={faq.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4 hover:border-slate-300 transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">
                    #{faq.order}
                  </span>
                  <h2 className="font-bold text-base text-[#08090B]">
                    {faq.question}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      faq.published
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {faq.published ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                  {faq.answer}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={reordering || idx === 0}
                  onClick={() => handleMove(idx, -1)}
                  aria-label={`Move "${faq.question}" up`}
                  className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                >
                  <ArrowUp className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={reordering || idx === sortedFaqs.length - 1}
                  onClick={() => handleMove(idx, 1)}
                  aria-label={`Move "${faq.question}" down`}
                  className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
                >
                  <ArrowDown className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => handleTogglePublished(faq)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    faq.published
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {faq.published ? "Published" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(faq)}
                  aria-label={`Edit "${faq.question}"`}
                  className="p-2 rounded-xl bg-slate-100 text-[#08090B] hover:bg-[#D7FF3D] transition-colors cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(faq)}
                  aria-label={`Delete "${faq.question}"`}
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
        title={editingId ? "Edit FAQ" : "Add FAQ"}
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

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3">
              <label
                htmlFor="faq-question"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Question * (max 300)
              </label>
              <input
                id="faq-question"
                type="text"
                required
                maxLength={300}
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="Who is a member of the EEE Club?"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="faq-order"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Order *
              </label>
              <input
                id="faq-order"
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
              htmlFor="faq-answer"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Answer * (plain text, line breaks kept, max 3000)
            </label>
            <textarea
              id="faq-answer"
              required
              rows={6}
              maxLength={3000}
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
              placeholder="Write a clear, concise answer…"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
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
              {saving ? "Saving…" : editingId ? "Save Changes" : "Create FAQ"}
            </button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete FAQ"
        message={
          deleteTarget ? `Permanently delete "${deleteTarget.question}"?` : ""
        }
      />
    </div>
  );
}
