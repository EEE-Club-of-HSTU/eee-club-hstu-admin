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

export const BLOG_TAGS = [
  "tutorial",
  "recap",
  "research",
  "career",
  "opinion",
  "news",
] as const;

export type BlogTag = (typeof BLOG_TAGS)[number];

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  authorRole?: string;
  tag: BlogTag;
  coverImageUrl?: string;
  readMinutes?: number;
  publishedOn: string;
  featured: boolean;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

export const LEADERSHIP_CATEGORIES = [
  "executive",
  "alumni",
  "advisory",
  "taskforce",
] as const;

export type LeadershipCategory = (typeof LEADERSHIP_CATEGORIES)[number];

export interface LeadershipMember {
  id: string;
  name: string;
  role: string;
  category: LeadershipCategory;
  subtitle?: string;
  session?: string;
  photoUrl?: string;
  order: number;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

export const GALLERY_CATEGORIES = [
  "competition",
  "workshop",
  "trip",
  "people",
  "other",
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

export interface GalleryItem {
  id: string;
  title: string;
  imageUrl: string;
  category: GalleryCategory;
  takenOn?: string;
  order: number;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MagazineTocEntry {
  page: number;
  title: string;
}

export interface MagazineIssue {
  id: string;
  issueNumber: number;
  title: string;
  season: string;
  summary?: string;
  coverImageUrl?: string;
  coverColor?: string;
  pdfUrl?: string;
  pages?: number;
  contents?: MagazineTocEntry[];
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

export const RESOURCE_KINDS = [
  "notes",
  "lab",
  "code",
  "exam",
  "other",
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export interface ResourceItem {
  id: string;
  title: string;
  kind: ResourceKind;
  course?: string;
  fileType?: string;
  size?: string;
  url: string;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  order: number;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PartnerItem {
  id: string;
  name: string;
  category?: string;
  logoUrl?: string;
  website?: string;
  order: number;
  published: boolean;
  createdAt: number;
  updatedAt: number;
}

export const STATIC_PAGE_IDS = [
  "constitution",
  "history",
  "privacy",
  "terms",
] as const;

export type StaticPageId = (typeof STATIC_PAGE_IDS)[number];

export interface StaticPageDoc {
  id: StaticPageId;
  title: string;
  content: string;
  /** Null when the document has no valid updatedAt (shown as "—"). */
  updatedAt: number | null;
}

export interface FooterSettings {
  email?: string;
  phone?: string;
  officeHours?: string;
  room?: string;
  address?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  youtubeUrl?: string;
  githubUrl?: string;
  updatedAt?: number;
}

export interface LocationSettings {
  name?: string;
  address?: string;
  mapUrl?: string;
  updatedAt?: number;
}
