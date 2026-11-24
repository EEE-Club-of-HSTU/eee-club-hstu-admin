"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { getErrorMessage } from "@/lib/format";
import { ShieldAlert, LogOut } from "lucide-react";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  adminEmail: string | null;
  loading: boolean;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  adminEmail: null,
  loading: true,
  authError: null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    let checkSeq = 0;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) return;
      const seq = ++checkSeq;
      setAuthError(null);
      setIsAdmin(false);
      setAdminEmail(null);

      if (!currentUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const targetUid = currentUser.uid;
      setLoading(true);
      setUser(currentUser);
      try {
        const adminSnap = await getDoc(doc(db, "admins", targetUid));
        if (!active || seq !== checkSeq || auth.currentUser?.uid !== targetUid) {
          return;
        }
        if (adminSnap.exists()) {
          const data = adminSnap.data();
          setIsAdmin(true);
          setAdminEmail(
            typeof data.email === "string" && data.email ? data.email : currentUser.email
          );
        } else {
          setIsAdmin(false);
          setAdminEmail(null);
        }
      } catch (err) {
        if (!active || seq !== checkSeq || auth.currentUser?.uid !== targetUid) {
          return;
        }
        setIsAdmin(false);
        setAdminEmail(null);
        setAuthError(getErrorMessage(err, "Failed to verify admin permissions."));
      } finally {
        if (active && seq === checkSeq && auth.currentUser?.uid === targetUid) {
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
    } else if (user && isAdmin && pathname === "/login") {
      router.replace("/");
    }
  }, [user, isAdmin, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] text-[#08090B] gap-3">
        <div className="w-8 h-8 rounded-full border-3 border-[#08090B] border-t-[#D7FF3D] animate-spin" />
        <p className="text-sm font-medium text-slate-600">Checking session…</p>
      </div>
    );
  }

  if (user && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-[28px] p-8 shadow-[0_12px_40px_rgba(8,9,11,0.08)] text-center space-y-5">
          <img
            src="/logo.png"
            alt="EEE Club of HSTU logo"
            className="w-16 h-16 mx-auto rounded-2xl object-contain border border-slate-100 bg-white p-1"
          />
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50 text-red-600 mx-auto">
            <ShieldAlert className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-[#08090B]">This account is not an admin</h1>
            <p className="text-sm text-slate-500">
              Signed in as <span className="font-medium text-[#08090B]">{user.email || user.uid}</span>, which does not
              have an <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">admins/{user.uid}</code> record.
            </p>
            {authError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2.5 mt-2">
                {authError}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm px-5 py-3 hover:brightness-95 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!user && pathname !== "/login") {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, adminEmail, loading, authError }}>
      {children}
    </AuthContext.Provider>
  );
}
