import type { Timestamp } from "firebase/firestore";

export const EVENT_TYPES = [
  "workshop",
  "competition",
  "seminar",
  "trip",
  "outreach",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface EventLog {
  id: string;
  title: string;
  type: EventType;
  startsAt: string;
  endsAt?: string;
  venue: string;
  summary?: string;
  link?: string;
  featured: boolean;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

export const NOTICE_CATEGORIES = [
  "general",
  "events",
  "lab",
  "publication",
  "alumni",
] as const;

export type NoticeCategory = (typeof NOTICE_CATEGORIES)[number];

export interface Notice {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  noticeDate: string;
  pinned: boolean;
  link?: string;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

export const CERTIFICATE_STATUSES = ["valid", "revoked"] as const;

export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export interface Certificate {
  id: string;
  type: string;
  name: string;
  details: string;
  issuedOn: string;
  status: CertificateStatus;
  createdAt: number;
  updatedAt: number;
}

export const ALUMNI_STATUSES = ["pending", "approved", "rejected"] as const;

export type AlumniStatus = (typeof ALUMNI_STATUSES)[number];

export const ALUMNI_INTERESTS = [
  "mentoring",
  "guest_talks",
  "hiring",
  "donations",
  "events",
  "research",
] as const;

export type FirestoreTimestampLike = Timestamp | number | null | undefined;

export interface AlumniRegistration {
  id: string;
  fullName: string;
  session: string;
  graduationYear: number;
  email: string;
  studentId?: string;
  phone?: string;
  currentRole?: string;
  organization?: string;
  city?: string;
  linkedin?: string;
  interests?: string[];
  message?: string;
  consent: boolean;
  status: AlumniStatus;
  source?: string;
  createdAt?: FirestoreTimestampLike;
  reviewedAt?: number;
  adminNote?: string;
}

export const CONTACT_TOPICS = [
  "general",
  "partnership",
  "alumni",
  "media",
  "sponsorship",
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const MESSAGE_STATUSES = ["new", "read", "archived"] as const;

export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  organization?: string;
  topic: ContactTopic;
  message: string;
  status: MessageStatus;
  createdAt?: FirestoreTimestampLike;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  createdAt?: FirestoreTimestampLike;
}
