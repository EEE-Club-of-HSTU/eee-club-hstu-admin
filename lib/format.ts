import { Timestamp } from "firebase/firestore";
import Papa from "papaparse";
import type { FirestoreTimestampLike } from "./types";

/** Converts a Firestore Timestamp or epoch ms number to a Date, or null if absent/invalid. */
export function toDateSafe(value: FirestoreTimestampLike): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }
  return null;
}

/** Converts a Firestore Timestamp or epoch ms number to epoch ms, or null if absent/invalid. */
export function getTimestampMs(value: FirestoreTimestampLike): number | null {
  const date = toDateSafe(value);
  if (!date) return null;
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Sorts documents descending by createdAt, placing documents missing createdAt last. */
export function sortByCreatedAtDesc<T extends { createdAt?: FirestoreTimestampLike }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const aMs = getTimestampMs(a.createdAt);
    const bMs = getTimestampMs(b.createdAt);
    if (aMs === null && bMs === null) return 0;
    if (aMs === null) return 1;
    if (bMs === null) return -1;
    return bMs - aMs;
  });
}

/** Formats a Firestore Timestamp or epoch ms number for table display in Asia/Dhaka. */
export function formatTimestamp(value: FirestoreTimestampLike): string {
  const date = toDateSafe(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Formats a Firestore Timestamp or epoch ms number as an ISO string for CSV export. */
export function formatTimestampIso(value: FirestoreTimestampLike): string {
  const date = toDateSafe(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

/** Returns today's calendar date (YYYY-MM-DD) in Asia/Dhaka (UTC+6). */
export function getDhakaTodayDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(
    new Date()
  );
}

/** Combines YYYY-MM-DD and HH:MM inputs into a Bangladesh (+06:00) ISO 8601 string. */
export function combineDhakaDateTime(date: string, time: string): string {
  const hhmm = time.slice(0, 5);
  return `${date}T${hhmm}:00+06:00`;
}

/** Extracts YYYY-MM-DD and HH:MM in Asia/Dhaka without depending on the browser's local timezone. */
export function splitDhakaDateTime(iso?: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const trimmed = iso.trim();
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(parsed);
      const get = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value ?? "";
      const hour = get("hour") === "24" ? "00" : get("hour");
      const year = get("year");
      const month = get("month");
      const day = get("day");
      const minute = get("minute");
      if (year && month && day && hour && minute) {
        return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
      }
    }
  }
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(trimmed);
  if (match) {
    return { date: match[1], time: match[2] };
  }
  return { date: "", time: "" };
}

/** Formats an ISO event timestamp in Asia/Dhaka (UTC+6). */
export function formatEventDate(iso?: string): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Validates an external URL to prevent unsafe protocols such as javascript:. */
export function safeExternalHref(
  raw?: unknown,
  options?: { httpsOnly?: boolean }
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("//") || /[\s\u0000-\u001f\u007f]/.test(trimmed)) {
    return null;
  }
  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    if (options?.httpsOnly || !trimmed.includes(".")) {
      return null;
    }
    candidate = `https://${trimmed}`;
  }
  try {
    const parsed = new URL(candidate);
    const allowedProtocols = options?.httpsOnly ? ["https:"] : ["https:", "http:"];
    if (!allowedProtocols.includes(parsed.protocol) || !parsed.hostname) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

export type ContentLinkValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/** Validates an optional event/notice link as a relative page path or an https:// URL. */
export function validateContentLink(raw?: unknown): ContentLinkValidationResult {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    return { ok: true, value: "" };
  }
  if (trimmed.length > 300) {
    return { ok: false, error: "Link must be 300 characters or fewer." };
  }
  if (/[\s\u0000-\u001f\u007f]/.test(trimmed)) {
    return {
      ok: false,
      error: "Link must be a relative page path (e.g. event.html) or an https:// URL.",
    };
  }
  if (/^https:\/\//i.test(trimmed)) {
    const safe = safeExternalHref(trimmed, { httpsOnly: true });
    if (!safe) {
      return {
        ok: false,
        error: "Link must be a relative page path (e.g. event.html) or an https:// URL.",
      };
    }
    return { ok: true, value: trimmed };
  }
  const firstSegment = trimmed.split(/[/?#]/, 1)[0] ?? "";
  if (
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ||
    firstSegment.includes(":")
  ) {
    return {
      ok: false,
      error: "Link must be a relative page path (e.g. event.html) or an https:// URL.",
    };
  }
  return { ok: true, value: trimmed };
}

/** Triggers a browser CSV download using Papa.unparse with formula injection escaping. */
export function downloadCsv(
  filename: string,
  rows: Record<string, string | number | boolean>[]
): void {
  const csv = Papa.unparse(rows, { escapeFormulae: true });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Extracts a readable error message from an unknown thrown value. */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
