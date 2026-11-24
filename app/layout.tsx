import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EEE Club Admin",
  description: "Admin dashboard for EEE Club of HSTU.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body suppressHydrationWarning className="font-sans antialiased bg-[#F8FAFC] text-[#08090B]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
