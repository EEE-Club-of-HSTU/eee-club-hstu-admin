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
import { isValidInt } from "@/lib/format";
import { setFlags } from "@/lib/ordering";
import {
  estimateReadMinutes,
  getDhakaTodayDate,
  getErrorMessage,
  getTimestampMs,
  resolveMediaUrl,
  validateMediaUrl,
} from "@/lib/format";
import { BLOG_TAGS, type BlogPost, type BlogTag } from "@/lib/types";
import { ModalDialog } from "@/components/modal-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MarkdownPreview } from "@/components/markdown-preview";
import {
  BookOpen,
  Calendar,
  Clock,
  Edit2,
  Eye,
  PenLine,
  Plus,
  Search,
  Star,
  Trash2,
  User,
} from "lucide-react";

interface BlogFormState {
  title: string;
  excerpt: string;
  content: string;
  author: string;
  authorRole: string;
  tag: BlogTag;
  coverImageUrl: string;
  readMinutes: string;
  publishedOn: string;
  featured: boolean;
  published: boolean;
}

const createEmptyForm = (): BlogFormState => ({
  title: "",
  excerpt: "",
  content: "",
  author: "",
  authorRole: "",
  tag: "tutorial",
  coverImageUrl: "",
  readMinutes: "1",
  publishedOn: getDhakaTodayDate(),
  featured: false,
  published: true,
});

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<"all" | BlogTag>("all");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BlogFormState>(createEmptyForm);
  const [readMinutesTouched, setReadMinutesTouched] = useState(false);
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "blogs"));
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BlogPost)));
    } catch (err) {
      setError(
        getErrorMessage(err, "Failed to load blog posts. Check database permissions.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const sortedAndFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...posts]
      .sort((a, b) => {
        const cmp = String(b.publishedOn ?? "").localeCompare(
          String(a.publishedOn ?? "")
        );
        if (cmp !== 0) return cmp;
        return (getTimestampMs(b.createdAt) ?? 0) - (getTimestampMs(a.createdAt) ?? 0);
      })
      .filter((post) => {
        if (tagFilter !== "all" && post.tag !== tagFilter) return false;
        if (!q) return true;
        return (
          String(post.title ?? "").toLowerCase().includes(q) ||
          String(post.excerpt ?? "").toLowerCase().includes(q) ||
          String(post.author ?? "").toLowerCase().includes(q) ||
          String(post.tag ?? "").toLowerCase().includes(q)
        );
      });
  }, [posts, tagFilter, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(createEmptyForm());
    setReadMinutesTouched(false);
    setEditorTab("write");
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    const content = String(post.content ?? "");
    const suggested = String(
      typeof post.readMinutes === "number" && Number.isFinite(post.readMinutes)
        ? post.readMinutes
        : estimateReadMinutes(content)
    );
    setEditingId(post.id);
    setForm({
      title: String(post.title ?? ""),
      excerpt: String(post.excerpt ?? ""),
      content,
      author: String(post.author ?? ""),
      authorRole: String(post.authorRole ?? ""),
      tag: BLOG_TAGS.includes(post.tag) ? post.tag : "tutorial",
      coverImageUrl: String(post.coverImageUrl ?? ""),
      readMinutes: suggested,
      publishedOn: String(post.publishedOn ?? getDhakaTodayDate()),
      featured: Boolean(post.featured),
      published: Boolean(post.published),
    });
    setReadMinutesTouched(post.readMinutes !== undefined);
    setEditorTab("write");
    setFormError(null);
    setModalOpen(true);
  };

  const handleContentChange = (nextContent: string) => {
    setForm((prev) => ({
      ...prev,
      content: nextContent,
      readMinutes: readMinutesTouched
        ? prev.readMinutes
        : String(estimateReadMinutes(nextContent)),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const title = form.title.trim();
    const excerpt = form.excerpt.trim();
    const content = form.content.trim();
    const author = form.author.trim();
    const authorRole = form.authorRole.trim();
    const publishedOn = form.publishedOn.trim();

    if (!title || title.length > 200) {
      setFormError("Title is required and must be 200 characters or fewer.");
      return;
    }
    if (!excerpt || excerpt.length > 400) {
      setFormError("Excerpt is required and must be 400 characters or fewer.");
      return;
    }
    if (!content || content.length > 60000) {
      setFormError("Markdown content is required and must be 60,000 characters or fewer.");
      return;
    }
    if (!author || author.length > 120) {
      setFormError("Author is required and must be 120 characters or fewer.");
      return;
    }
    if (authorRole.length > 120) {
      setFormError("Author role must be 120 characters or fewer.");
      return;
    }
    if (!BLOG_TAGS.includes(form.tag)) {
      setFormError("Select a valid tag.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedOn)) {
      setFormError("Published date must be YYYY-MM-DD.");
      return;
    }

    const coverCheck = validateMediaUrl(form.coverImageUrl, {
      label: "Cover image URL",
    });
    if (!coverCheck.ok) {
      setFormError(coverCheck.error);
      return;
    }

    let parsedReadMinutes: number | undefined;
    const rawRead = form.readMinutes.trim();
    if (rawRead) {
      const n = Number(rawRead);
      if (!isValidInt(n) || n < 1 || n > 999) {
        setFormError("Read minutes must be a whole number between 1 and 999.");
        return;
      }
      parsedReadMinutes = n;
    }

    const featured = Boolean(form.featured);
    const published = Boolean(form.published);
    const now = Date.now();

    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "blogs", editingId), {
          title,
          excerpt,
          content,
          author,
          authorRole: authorRole || deleteField(),
          tag: form.tag,
          coverImageUrl: coverCheck.value || deleteField(),
          readMinutes: parsedReadMinutes ?? deleteField(),
          publishedOn,
          featured,
          published,
          updatedAt: now,
        });
      } else {
        const payload: Record<string, string | number | boolean> = {
          title,
          excerpt,
          content,
          author,
          tag: form.tag,
          publishedOn,
          featured,
          published,
          createdAt: now,
          updatedAt: now,
        };
        if (authorRole) payload.authorRole = authorRole;
        if (coverCheck.value) payload.coverImageUrl = coverCheck.value;
        if (parsedReadMinutes !== undefined) {
          payload.readMinutes = parsedReadMinutes;
        }
        await addDoc(collection(db, "blogs"), payload);
      }
      setModalOpen(false);
      await fetchPosts();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save blog post."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFlag = async (
    post: BlogPost,
    field: "featured" | "published"
  ) => {
    const nextValue = !Boolean(post[field]);
    try {
      const updatedAt = await setFlags("blogs", post.id, { [field]: nextValue });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, [field]: nextValue, updatedAt } : p
        )
      );
    } catch (err) {
      setError(getErrorMessage(err, `Failed to update ${field} state.`));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "blogs", deleteTarget.id));
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete blog post."));
    } finally {
      setDeleting(false);
    }
  };

  const coverPreviewUrl = resolveMediaUrl(form.coverImageUrl);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#08090B]">
            Blog Posts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Publish Markdown tutorials, recaps, and research notes with LaTeX math support.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm px-5 py-2.5 shadow-sm hover:brightness-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          New Post
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by tag">
          <button
            type="button"
            onClick={() => setTagFilter("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              tagFilter === "all"
                ? "bg-[#08090B] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({posts.length})
          </button>
          {BLOG_TAGS.map((tag) => {
            const count = posts.filter((p) => p.tag === tag).length;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(tag)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors cursor-pointer ${
                  tagFilter === tag
                    ? "bg-[#D7FF3D] text-[#08090B] ring-1 ring-[#08090B]/20"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tag} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, author, excerpt…"
            aria-label="Search blog posts"
            className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3.5 py-2 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
          />
        </div>
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
          Loading blog posts…
        </div>
      ) : sortedAndFiltered.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-sm text-slate-500">
          {posts.length === 0
            ? "No blog posts yet. Create one or load demo content from the dashboard."
            : "No blog posts match your current filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedAndFiltered.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-slate-300 transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-base text-[#08090B]">
                    {post.title}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize bg-slate-100 text-slate-700">
                    {post.tag}
                  </span>
                  {post.featured && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#D7FF3D] text-[#08090B]">
                      <Star className="w-3 h-3" aria-hidden="true" />
                      Featured
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      post.published
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {post.published ? "Published" : "Draft"}
                  </span>
                </div>

                <p className="text-sm text-slate-600 line-clamp-2">
                  {post.excerpt}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3.5 h-3.5" aria-hidden="true" />
                    {post.author}
                    {post.authorRole ? ` · ${post.authorRole}` : ""}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    {post.publishedOn}
                  </span>
                  {typeof post.readMinutes === "number" && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      {post.readMinutes} min read
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleFlag(post, "featured")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    post.featured
                      ? "bg-[#D7FF3D] border-[#08090B]/20 text-[#08090B]"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {post.featured ? "Featured" : "Feature"}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleFlag(post, "published")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    post.published
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {post.published ? "Published" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(post)}
                  aria-label={`Edit ${post.title}`}
                  className="p-2 rounded-xl bg-slate-100 text-[#08090B] hover:bg-[#D7FF3D] transition-colors cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(post)}
                  aria-label={`Delete ${post.title}`}
                  className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ModalDialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Blog Post" : "New Blog Post"}
        maxWidthClass="max-w-5xl"
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
                htmlFor="blog-title"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Title * (max 200)
              </label>
              <input
                id="blog-title"
                type="text"
                required
                maxLength={200}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Writing your first bare-metal driver for STM32"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="blog-tag"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Tag *
              </label>
              <select
                id="blog-tag"
                value={form.tag}
                onChange={(e) =>
                  setForm({ ...form, tag: e.target.value as BlogTag })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm capitalize text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              >
                {BLOG_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="blog-excerpt"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Excerpt * (shown on cards, max 400)
            </label>
            <textarea
              id="blog-excerpt"
              required
              rows={2}
              maxLength={400}
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              placeholder="Short summary for the blog listing…"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="blog-author"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Author *
              </label>
              <input
                id="blog-author"
                type="text"
                required
                maxLength={120}
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                placeholder="Arif Mahmud"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="blog-author-role"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Author Role
              </label>
              <input
                id="blog-author-role"
                type="text"
                maxLength={120}
                value={form.authorRole}
                onChange={(e) =>
                  setForm({ ...form, authorRole: e.target.value })
                }
                placeholder="Head · Robotics"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="blog-published-on"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Published On *
              </label>
              <input
                id="blog-published-on"
                type="date"
                required
                value={form.publishedOn}
                onChange={(e) =>
                  setForm({ ...form, publishedOn: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>

            <div>
              <label
                htmlFor="blog-read-minutes"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Read Minutes
              </label>
              <input
                id="blog-read-minutes"
                type="number"
                min={1}
                max={999}
                value={form.readMinutes}
                onChange={(e) => {
                  const val = e.target.value;
                  setReadMinutesTouched(val.trim().length > 0);
                  setForm({ ...form, readMinutes: val });
                }}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-2">
              <label
                htmlFor="blog-cover"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Cover Image URL (optional, https:// or site path)
              </label>
              <input
                id="blog-cover"
                type="text"
                maxLength={500}
                value={form.coverImageUrl}
                onChange={(e) =>
                  setForm({ ...form, coverImageUrl: e.target.value })
                }
                placeholder="https://… or assets/blog/cover.jpg"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
            </div>
            <div className="h-11 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden px-3">
              {coverPreviewUrl ? (
                <img
                  src={coverPreviewUrl}
                  alt="Cover preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[11px] text-slate-400 truncate">
                  {form.coverImageUrl.trim()
                    ? "Relative path preview needs NEXT_PUBLIC_SITE_URL"
                    : "No cover image"}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="blog-content"
                className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                Markdown Content * ({form.content.length.toLocaleString()} / 60,000)
              </label>
              <div className="flex lg:hidden items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setEditorTab("write")}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    editorTab === "write"
                      ? "bg-white text-[#08090B] shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab("preview")}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                    editorTab === "preview"
                      ? "bg-white text-[#08090B] shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  Preview
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={editorTab === "preview" ? "hidden lg:block" : "block"}>
                <textarea
                  id="blog-content"
                  required
                  rows={14}
                  maxLength={60000}
                  value={form.content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Write Markdown here… Supports GFM tables, code blocks, and LaTeX ($V = IR$, $$P = I^2 R$$)."
                  className="w-full h-80 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-xs leading-relaxed text-[#08090B] outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D] resize-y"
                />
              </div>
              <div
                className={`${
                  editorTab === "write" ? "hidden lg:block" : "block"
                } h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4`}
              >
                <MarkdownPreview content={form.content} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-1">
            <label className="inline-flex items-center gap-2.5 text-sm font-medium text-[#08090B] cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) =>
                  setForm({ ...form, featured: e.target.checked })
                }
                className="w-4 h-4 accent-[#08090B]"
              />
              Featured (leads the blog page)
            </label>
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
              {saving ? "Saving…" : editingId ? "Save Changes" : "Publish Post"}
            </button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Delete blog post"
        message={
          deleteTarget ? `Permanently delete "${deleteTarget.title}"?` : ""
        }
      />
    </div>
  );
}
