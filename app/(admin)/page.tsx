"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { loadDemoContent } from "@/lib/demo-data";
import {
  formatTimestamp,
  getErrorMessage,
  sortByCreatedAtDesc,
} from "@/lib/format";
import type {
  AlumniRegistration,
  ContactMessage,
  EventLog,
  Notice,
} from "@/lib/types";
import {
  ArrowRight,
  Award,
  Bell,
  Calendar,
  GraduationCap,
  Mail,
  Newspaper,
  Sparkles,
} from "lucide-react";

interface DashboardStats {
  pendingAlumni: number;
  newMessages: number;
  upcomingEvents: number;
  publishedNotices: number;
  certificates: number;
  subscribers: number;
  totalEvents: number;
  totalNotices: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [latestAlumni, setLatestAlumni] = useState<AlumniRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        alumniSnap,
        messagesSnap,
        eventsSnap,
        noticesSnap,
        certsSnap,
        newsletterSnap,
      ] = await Promise.all([
        getDocs(collection(db, "alumni_registrations")),
        getDocs(collection(db, "contact_messages")),
        getDocs(collection(db, "event_logs")),
        getDocs(collection(db, "notices")),
        getDocs(collection(db, "certificates")),
        getDocs(collection(db, "newsletter_subscribers")),
      ]);

      const alumniList = sortByCreatedAtDesc(
        alumniSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as AlumniRegistration)
        )
      );
      const messagesList = messagesSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as ContactMessage)
      );
      const eventsList = eventsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as EventLog)
      );
      const noticesList = noticesSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as Notice)
      );

      const nowMs = Date.now();
      const upcomingPublished = eventsList.filter((ev) => {
        if (!ev.published) return false;
        const t = new Date(String(ev.startsAt ?? "")).getTime();
        return Number.isFinite(t) && t >= nowMs;
      }).length;

      setStats({
        pendingAlumni: alumniList.filter((a) => a.status === "pending").length,
        newMessages: messagesList.filter((m) => m.status === "new").length,
        upcomingEvents: upcomingPublished,
        publishedNotices: noticesList.filter((n) => n.published).length,
        certificates: certsSnap.size,
        subscribers: newsletterSnap.size,
        totalEvents: eventsSnap.size,
        totalNotices: noticesSnap.size,
      });
      setLatestAlumni(alumniList.slice(0, 5));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load dashboard data. Check Firestore permissions."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleLoadDemo = async () => {
    if (seeding) return;
    setSeeding(true);
    setError(null);
    try {
      await loadDemoContent();
      await fetchDashboard();
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to load demo content.");
      await fetchDashboard();
      setError(msg);
    } finally {
      setSeeding(false);
    }
  };

  const showDemoButton =
    !loading &&
    !error &&
    stats !== null &&
    stats.totalEvents === 0 &&
    stats.totalNotices === 0 &&
    stats.certificates === 0;

  const statCards = [
    {
      label: "Pending alumni",
      value: stats?.pendingAlumni ?? 0,
      hint: "Awaiting review",
      href: "/alumni",
      icon: GraduationCap,
    },
    {
      label: "New messages",
      value: stats?.newMessages ?? 0,
      hint: "Unread inbox items",
      href: "/messages",
      icon: Mail,
    },
    {
      label: "Upcoming events",
      value: stats?.upcomingEvents ?? 0,
      hint: "Published on calendar",
      href: "/events",
      icon: Calendar,
    },
    {
      label: "Published notices",
      value: stats?.publishedNotices ?? 0,
      hint: "Live announcements",
      href: "/notices",
      icon: Bell,
    },
    {
      label: "Certificates",
      value: stats?.certificates ?? 0,
      hint: "Issued records",
      href: "/certificates",
      icon: Award,
    },
    {
      label: "Newsletter subscribers",
      value: stats?.subscribers ?? 0,
      hint: "Pulse mailing list",
      href: "/newsletter",
      icon: Newspaper,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
            Operational Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            EEE Club of HSTU shared Firestore status and recent activity.
          </p>
        </div>

        {showDemoButton && (
          <button
            type="button"
            disabled={seeding}
            onClick={handleLoadDemo}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm px-5 py-3 shadow-sm hover:brightness-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {seeding ? "Loading demo content…" : "Load demo content"}
          </button>
        )}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group rounded-[22px] border border-slate-200 bg-slate-50/60 p-5 hover:bg-white hover:border-[#08090B]/30 hover:shadow-[0_12px_32px_rgba(8,9,11,0.06)] transition-all"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {card.label}
              </span>
              <span className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#08090B] group-hover:bg-[#D7FF3D] group-hover:border-[#D7FF3D] transition-colors">
                <card.icon className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
            <p className="text-3xl font-bold text-[#08090B]">
              {loading ? "…" : card.value}
            </p>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center justify-between">
              <span>{card.hint}</span>
              <ArrowRight
                className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#08090B] transition-colors"
                aria-hidden="true"
              />
            </p>
          </Link>
        ))}
      </div>

      <section className="rounded-[24px] border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-[#08090B]">
              Latest alumni registrations
            </h2>
            <p className="text-xs text-slate-500">Most recent 5 submissions</p>
          </div>
          <Link
            href="/alumni"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#08090B] bg-slate-100 hover:bg-[#D7FF3D] px-3.5 py-2 rounded-xl transition-colors"
          >
            View all
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading alumni registrations…
          </div>
        ) : latestAlumni.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No alumni registrations yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {latestAlumni.map((item) => (
              <li key={item.id}>
                <Link
                  href="/alumni"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-semibold text-sm text-[#08090B]">
                        {item.fullName}
                      </span>
                      <span className="text-xs text-slate-500">
                        Session {item.session} · Class of {item.graduationYear}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {[item.currentRole, item.organization].filter(Boolean).join(" — ") ||
                        item.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-400">
                      {formatTimestamp(item.createdAt)}
                    </span>
                    <StatusPill status={item.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: AlumniRegistration["status"] }) {
  const styles: Record<AlumniRegistration["status"], string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize border ${
        styles[status] || "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {status}
    </span>
  );
}
