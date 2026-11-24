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
  combineDhakaDateTime,
  formatEventDate,
  getErrorMessage,
  sortByCreatedAtDesc,
  splitDhakaDateTime,
  validateContentLink,
} from "@/lib/format";
import { EVENT_TYPES, type EventLog, type EventType } from "@/lib/types";
import { ModalDialog } from "@/components/modal-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Calendar, Edit2, MapPin, Plus, Star, Trash2 } from "lucide-react";

interface EventFormState {
  title: string;
  type: EventType;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  venue: string;
  summary: string;
  link: string;
  featured: boolean;
  published: boolean;
}

const emptyForm: EventFormState = {
  title: "",
  type: "workshop",
  startDate: "",
  startTime: "10:00",
  endDate: "",
  endTime: "",
  venue: "",
  summary: "",
  link: "",
  featured: false,
  published: true,
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventLog | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "event_logs"));
      setEvents(
        sortByCreatedAtDesc(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventLog))
        )
      );
    } catch (err) {
      setError(
        getErrorMessage(err, "Failed to load events. Check database permissions.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: EventLog[] = [];
    const pa: EventLog[] = [];
    for (const ev of events) {
      const t = new Date(String(ev.startsAt ?? "")).getTime();
      if (Number.isFinite(t) && t >= now) {
        up.push(ev);
      } else {
        pa.push(ev);
      }
    }
    up.sort(
      (a, b) =>
        new Date(String(a.startsAt ?? "")).getTime() -
        new Date(String(b.startsAt ?? "")).getTime()
    );
    pa.sort((a, b) => {
      const ta = new Date(String(a.startsAt ?? "")).getTime();
      const tb = new Date(String(b.startsAt ?? "")).getTime();
      const safeA = Number.isFinite(ta) ? ta : -Infinity;
      const safeB = Number.isFinite(tb) ? tb : -Infinity;
      return safeB - safeA;
    });
    return { upcoming: up, past: pa };
  }, [events]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (ev: EventLog) => {
    const start = splitDhakaDateTime(ev.startsAt);
    const end = splitDhakaDateTime(ev.endsAt);
    setEditingId(ev.id);
    setForm({
      title: String(ev.title ?? ""),
      type: EVENT_TYPES.includes(ev.type) ? ev.type : "workshop",
      startDate: start.date,
      startTime: start.time || "10:00",
      endDate: end.date,
      endTime: end.time,
      venue: String(ev.venue ?? ""),
      summary: String(ev.summary ?? ""),
      link: String(ev.link ?? ""),
      featured: Boolean(ev.featured),
      published: Boolean(ev.published),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const title = form.title.trim();
    const venue = form.venue.trim();
    const summary = form.summary.trim();

    if (!title || title.length > 160) {
      setFormError("Title is required and must be 160 characters or fewer.");
      return;
    }
    if (!EVENT_TYPES.includes(form.type)) {
      setFormError("Select a valid event type.");
      return;
    }
    if (!form.startDate || !form.startTime) {
      setFormError("Start date and time are required.");
      return;
    }
    if ((form.endDate && !form.endTime) || (!form.endDate && form.endTime)) {
      setFormError("Provide both an end date and end time, or leave both empty.");
      return;
    }
    if (!venue || venue.length > 160) {
      setFormError("Venue is required and must be 160 characters or fewer.");
      return;
    }
    if (summary.length > 600) {
      setFormError("Summary must be 600 characters or fewer.");
      return;
    }

    const linkCheck = validateContentLink(form.link);
    if (!linkCheck.ok) {
      setFormError(linkCheck.error);
      return;
    }

    const startsAt = combineDhakaDateTime(form.startDate, form.startTime);
    const endsAt =
      form.endDate && form.endTime
        ? combineDhakaDateTime(form.endDate, form.endTime)
        : undefined;
    const featured = Boolean(form.featured);
    const published = Boolean(form.published);
    const now = Date.now();

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "event_logs", editingId), {
          title,
          type: form.type,
          startsAt,
          endsAt: endsAt ?? deleteField(),
          venue,
          summary: summary || deleteField(),
          link: linkCheck.value || deleteField(),
          featured,
          published,
          updatedAt: now,
        });
      } else {
        const payload: Record<string, string | boolean | number> = {
          title,
          type: form.type,
          startsAt,
          venue,
          featured,
          published,
          createdAt: now,
          updatedAt: now,
        };
        if (endsAt) payload.endsAt = endsAt;
        if (summary) payload.summary = summary;
        if (linkCheck.value) payload.link = linkCheck.value;
        await addDoc(collection(db, "event_logs"), payload);
      }
      setModalOpen(false);
      await fetchEvents();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save event."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFlag = async (
    ev: EventLog,
    field: "featured" | "published"
  ) => {
    const nextValue = !Boolean(ev[field]);
    const featured = field === "featured" ? nextValue : Boolean(ev.featured);
    const published = field === "published" ? nextValue : Boolean(ev.published);
    const endsAt = String(ev.endsAt ?? "").trim();
    const summary = String(ev.summary ?? "").trim();
    const link = String(ev.link ?? "").trim();
    const updatedAt = Date.now();
    try {
      await updateDoc(doc(db, "event_logs", ev.id), {
        title: String(ev.title ?? "").trim(),
        type: EVENT_TYPES.includes(ev.type) ? ev.type : "workshop",
        startsAt: String(ev.startsAt ?? "").trim(),
        endsAt: endsAt || deleteField(),
        venue: String(ev.venue ?? "").trim(),
        summary: summary || deleteField(),
        link: link || deleteField(),
        featured,
        published,
        updatedAt,
      });
      setEvents((prev) =>
        prev.map((item) =>
          item.id === ev.id
            ? { ...item, featured, published, updatedAt }
            : item
        )
      );
    } catch (err) {
      setError(getErrorMessage(err, `Failed to update ${field} status.`));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "event_logs", deleteTarget.id));
      setEvents((prev) => prev.filter((ev) => ev.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete event."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
            Events
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage club workshops, competitions, seminars, trips, and outreach (UTC+6).
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm px-5 py-2.5 shadow-sm hover:brightness-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Event
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
          Loading events…
        </div>
      ) : events.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-500">
          No events found. Add your first event or load demo content from the dashboard.
        </div>
      ) : (
        <div className="space-y-8">
          <EventSection
            title={`Upcoming (${upcoming.length})`}
            emptyText="No upcoming events."
            items={upcoming}
            onToggle={handleToggleFlag}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
          <EventSection
            title={`Past (${past.length})`}
            emptyText="No past events."
            items={past}
            onToggle={handleToggleFlag}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        </div>
      )}

      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Event" : "Add Event"}
        maxWidthClass="max-w-2xl"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="event-title"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Title *
              </label>
              <input
                id="event-title"
                type="text"
                required
                maxLength={160}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Embedded Bootcamp"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="event-type"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Type *
              </label>
              <select
                id="event-type"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as EventType })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm capitalize text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="event-start-date"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Starts Date (+06:00) *
              </label>
              <input
                id="event-start-date"
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
            <div>
              <label
                htmlFor="event-start-time"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Starts Time (+06:00) *
              </label>
              <input
                id="event-start-time"
                type="time"
                required
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="event-end-date"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Ends Date (optional)
              </label>
              <input
                id="event-end-date"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
            <div>
              <label
                htmlFor="event-end-time"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Ends Time (optional)
              </label>
              <input
                id="event-end-time"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="event-venue"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Venue *
              </label>
              <input
                id="event-venue"
                type="text"
                required
                maxLength={160}
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                placeholder="e.g. EEE Microprocessor Lab, HSTU"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
            <div>
              <label
                htmlFor="event-link"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Link (optional)
              </label>
              <input
                id="event-link"
                type="text"
                maxLength={300}
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="event.html or https://…"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="event-summary"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Summary (optional, max 600 chars)
            </label>
            <textarea
              id="event-summary"
              rows={3}
              maxLength={600}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="Brief overview for the public event listing…"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div className="flex flex-wrap gap-6 pt-1">
            <label className="inline-flex items-center gap-2.5 text-sm font-medium text-[#08090B] cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                className="w-4 h-4 accent-[#08090B]"
              />
              Featured (drives homepage countdown)
            </label>
            <label className="inline-flex items-center gap-2.5 text-sm font-medium text-[#08090B] cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="w-4 h-4 accent-[#08090B]"
              />
              Published (visible on public site)
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
              {saving ? "Saving…" : editingId ? "Save Changes" : "Create Event"}
            </button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete event"
        message={
          deleteTarget ? `Permanently delete "${deleteTarget.title}"?` : ""
        }
      />
    </div>
  );
}

function EventSection({
  title,
  emptyText,
  items,
  onToggle,
  onEdit,
  onDelete,
}: {
  title: string;
  emptyText: string;
  items: EventLog[];
  onToggle: (ev: EventLog, field: "featured" | "published") => void;
  onEdit: (ev: EventLog) => void;
  onDelete: (ev: EventLog) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((ev) => (
            <div
              key={ev.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-base text-[#08090B]">
                    {ev.title}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize bg-slate-100 text-slate-700">
                    {ev.type}
                  </span>
                  {ev.featured && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#D7FF3D] text-[#08090B]">
                      <Star className="w-3 h-3" aria-hidden="true" />
                      Featured
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      ev.published
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {ev.published ? "Published" : "Draft"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    {formatEventDate(ev.startsAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    {ev.venue}
                  </span>
                  {ev.link && (
                    <span className="font-mono text-[11px] text-slate-500">
                      Link: {ev.link}
                    </span>
                  )}
                </div>

                {ev.summary && (
                  <p className="text-sm text-slate-600 line-clamp-2">
                    {ev.summary}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggle(ev, "featured")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    ev.featured
                      ? "bg-[#D7FF3D] border-[#08090B]/20 text-[#08090B]"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {ev.featured ? "Featured" : "Feature"}
                </button>
                <button
                  type="button"
                  onClick={() => onToggle(ev, "published")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    ev.published
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {ev.published ? "Published" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(ev)}
                  aria-label={`Edit ${ev.title}`}
                  className="p-2 rounded-xl bg-slate-100 text-[#08090B] hover:bg-[#D7FF3D] transition-colors cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(ev)}
                  aria-label={`Delete ${ev.title}`}
                  className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
