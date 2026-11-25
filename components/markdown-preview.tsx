"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { resolveMediaUrl, safeExternalHref } from "@/lib/format";

interface MarkdownPreviewProps {
  content: string;
  emptyText?: string;
  className?: string;
}

function resolveMarkdownHref(href?: string): string | null {
  const trimmed = String(href ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    return safeExternalHref(trimmed, { httpsOnly: false });
  }
  return resolveMediaUrl(trimmed);
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold tracking-tight text-[#08090B] mt-6 mb-3 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-bold tracking-tight text-[#08090B] mt-6 mb-2.5 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-bold text-[#08090B] mt-5 mb-2 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-7 text-slate-700 my-3 first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-6 my-3 space-y-1.5 text-sm text-slate-700">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 my-3 space-y-1.5 text-sm text-slate-700">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-[#D7FF3D] bg-slate-50 px-4 py-2.5 rounded-r-xl text-sm italic text-slate-700">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className && className.startsWith("language-"));
    if (isBlock) {
      return (
        <code className={`font-mono text-xs ${className ?? ""}`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="font-mono text-xs bg-slate-100 text-[#08090B] px-1.5 py-0.5 rounded-md border border-slate-200"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-2xl bg-[#08090B] text-slate-100 p-4 text-xs font-mono leading-relaxed">
      {children}
    </pre>
  ),
  a: ({ href, children }) => {
    const safeHref = resolveMarkdownHref(href);
    if (!safeHref) {
      return (
        <span className="underline decoration-slate-300 text-slate-700">
          {children}
        </span>
      );
    }
    const isHash = safeHref.startsWith("#");
    return (
      <a
        href={safeHref}
        target={isHash ? undefined : "_blank"}
        rel={isHash ? undefined : "noopener noreferrer"}
        className="font-medium text-[#08090B] underline decoration-[#D7FF3D] decoration-2 underline-offset-2 hover:bg-[#D7FF3D]/40 transition-colors"
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => {
    const safeSrc = typeof src === "string" ? resolveMediaUrl(src) : null;
    if (!safeSrc) {
      return (
        <span className="inline-block rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
          {alt ? `[Image: ${alt}]` : "[Image preview unavailable]"}
        </span>
      );
    }
    return (
      <img
        src={safeSrc}
        alt={alt ?? ""}
        className="my-4 max-w-full rounded-2xl border border-slate-200"
      />
    );
  },
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-xs border-collapse">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider">
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 font-bold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-t border-slate-100 text-slate-700">
      {children}
    </td>
  ),
  hr: () => <hr className="my-6 border-slate-200" />,
};

export function MarkdownPreview({
  content,
  emptyText = "Nothing to preview yet. Write Markdown or LaTeX ($...$ / $$...$$) on the left.",
  className = "",
}: MarkdownPreviewProps) {
  if (!content.trim()) {
    return (
      <div className={`text-sm text-slate-400 italic ${className}`}>
        {emptyText}
      </div>
    );
  }

  return (
    <div className={`min-w-0 break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
