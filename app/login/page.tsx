"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getErrorMessage } from "@/lib/format";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to sign in. Please check your credentials."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[28px] p-8 shadow-[0_16px_48px_rgba(8,9,11,0.08)]">
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src="/logo.png"
            alt="EEE Club of HSTU logo"
            className="w-16 h-16 rounded-2xl object-contain bg-white border border-slate-200 p-1 mb-4 shadow-sm"
          />
          <h1 className="text-2xl font-bold tracking-tight text-[#08090B]">
            EEE Club Admin
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Department of EEE, HSTU — Sign in to manage content
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              spellCheck={false}
              enterKeyHint="next"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@eee-hstu.org"
              className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3.5 py-2.5 text-sm text-[#08090B] placeholder-slate-400 outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                enterKeyHint="done"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-300 bg-slate-50/70 pl-3.5 pr-11 py-2.5 text-sm text-[#08090B] placeholder-slate-400 outline-none focus:border-[#08090B] focus:bg-white focus:ring-2 focus:ring-[#D7FF3D]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-[#08090B] hover:bg-slate-100 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#D7FF3D] text-[#08090B] font-semibold text-sm px-5 py-3 shadow-sm hover:brightness-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
