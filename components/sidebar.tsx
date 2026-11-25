"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import {
  Award,
  Bell,
  BookMarked,
  BookOpen,
  Calendar,
  FileText,
  FolderDown,
  GraduationCap,
  Handshake,
  HelpCircle,
  Images,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Newspaper,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

interface NavSection {
  name: string;
  items: Array<{
    name: string;
    href: string;
    icon: LucideIcon;
  }>;
}

const sections: NavSection[] = [
  {
    name: "Overview",
    items: [{ name: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    name: "Inbox",
    items: [
      { name: "Alumni", href: "/alumni", icon: GraduationCap },
      { name: "Messages", href: "/messages", icon: Mail },
      { name: "Newsletter", href: "/newsletter", icon: Newspaper },
    ],
  },
  {
    name: "Events",
    items: [
      { name: "Events", href: "/events", icon: Calendar },
      { name: "Notices", href: "/notices", icon: Bell },
      { name: "Certificates", href: "/certificates", icon: Award },
    ],
  },
  {
    name: "Content",
    items: [
      { name: "Blog", href: "/blog", icon: BookOpen },
      { name: "Magazine", href: "/magazine", icon: BookMarked },
      { name: "Resources", href: "/resources", icon: FolderDown },
      { name: "Gallery", href: "/gallery", icon: Images },
    ],
  },
  {
    name: "About",
    items: [
      { name: "Leadership", href: "/leadership", icon: Users },
      { name: "Partners", href: "/partners", icon: Handshake },
      { name: "Pages", href: "/pages", icon: FileText },
    ],
  },
  {
    name: "Support",
    items: [{ name: "FAQs", href: "/faqs", icon: HelpCircle }],
  },
  {
    name: "Settings",
    items: [{ name: "Settings", href: "/settings", icon: Settings }],
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-4" aria-label="Main navigation">
      {sections.map((section) => (
        <div key={section.name} className="space-y-1">
          <h2 className="px-4 text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            {section.name}
          </h2>
          {section.items.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-4 py-2 rounded-[16px] text-[14px] transition-all ${
                  isActive
                    ? "bg-[#D7FF3D] text-[#08090B] font-semibold shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-[#08090B]"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const { adminEmail } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;
    if (mobileOpen && !dialog.open) {
      dialog.showModal();
    } else if (!mobileOpen && dialog.open) {
      dialog.close();
    }
  }, [mobileOpen]);

  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;
    const onClose = () => setMobileOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  return (
    <>
      {/* Mobile top bar below lg */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0 z-20">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="EEE Club of HSTU"
            className="w-9 h-9 rounded-xl object-contain bg-white border border-slate-200 p-0.5"
          />
          <div>
            <p className="font-bold text-base leading-tight text-[#08090B]">
              EEE Club Admin
            </p>
            <p className="text-[11px] font-medium text-slate-500">EEE · HSTU</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-drawer"
          className="p-2.5 rounded-xl border border-slate-200 bg-white text-[#08090B] hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
      </header>

      {/* Mobile navigation drawer (<dialog>) */}
      <dialog
        id="mobile-nav-drawer"
        ref={drawerRef}
        aria-label="Navigation menu"
        {...({ closedby: "any" } as Record<string, string>)}
        onClick={(e) => {
          if (e.target === drawerRef.current) setMobileOpen(false);
        }}
        className="lg:hidden m-0 p-0 h-dvh max-h-dvh w-[280px] max-w-[85vw] border-r border-slate-200 bg-white text-[#08090B] open:flex open:flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="EEE Club of HSTU"
              className="w-9 h-9 rounded-xl object-contain bg-white border border-slate-200 p-0.5"
            />
            <div>
              <p className="font-bold text-base leading-tight text-[#08090B]">
                EEE Club Admin
              </p>
              <p className="text-[11px] text-slate-500">EEE · HSTU</p>
            </div>
          </div>
          <button
            type="button"
            autoFocus
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-[#08090B] cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <NavLinks onNavigate={() => setMobileOpen(false)} />
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0 space-y-2">
          {adminEmail && (
            <p className="px-2 text-xs text-slate-500 truncate" title={adminEmail}>
              {adminEmail}
            </p>
          )}
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:text-red-600 rounded-[14px] transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </dialog>

      {/* Desktop fixed left sidebar (lg+) */}
      <aside className="hidden lg:flex h-full w-[268px] shrink-0 flex-col bg-white border-r border-slate-200 z-20">
        <div className="px-6 pt-6 pb-4 shrink-0">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="EEE Club of HSTU"
              className="w-11 h-11 rounded-[14px] object-contain bg-white border border-slate-200 p-0.5 shadow-sm"
            />
            <div className="min-w-0">
              <h1 className="font-bold text-lg tracking-tight text-[#08090B] leading-tight">
                EEE Club Admin
              </h1>
              <p className="text-xs font-medium text-slate-500">EEE · HSTU</p>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <NavLinks />
        </div>

        <div className="p-4 shrink-0 bg-slate-50 border-t border-slate-200 space-y-2">
          {adminEmail && (
            <p className="px-2 text-xs text-slate-500 truncate" title={adminEmail}>
              {adminEmail}
            </p>
          )}
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-[14px] transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
