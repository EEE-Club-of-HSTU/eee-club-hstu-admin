"use client";

import { useAuth } from "@/components/auth-provider";
import { Sidebar } from "@/components/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading || !user || !isAdmin) return null;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#F8FAFC] text-[#08090B] overflow-hidden selection:bg-[#D7FF3D]/60">
      <div className="fixed inset-0 pointer-events-none opacity-50 bg-[radial-gradient(ellipse_at_top_right,_rgba(215,255,61,0.18),_transparent_55%)]" />
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative z-10 p-3 sm:p-4 lg:p-6">
        <div className="flex-1 overflow-auto bg-white border border-slate-200/80 shadow-[0_10px_40px_rgba(8,9,11,0.06)] rounded-[24px] lg:rounded-[28px]">
          <div className="p-4 sm:p-6 lg:p-8 min-h-full">{children}</div>
        </div>
      </main>
    </div>
  );
}
