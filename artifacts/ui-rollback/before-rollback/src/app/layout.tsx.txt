import type { Metadata } from "next";
import "./globals.css";
import { AppChrome } from "@/components/AppChrome";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Acadivo — School Management & ERP Platform",
  description:
    "Manage your school's students, teachers, attendance, fees, examinations, timetables and daily operations with Acadivo.",
  keywords: [
    "School Management System",
    "School ERP SaaS",
    "Fee Challan Software",
    "Student Attendance Register",
    "Marksheet Generator",
    "AKTech Digital Solutions",
    "Acadivo",
    "School Administration Software Pakistan",
  ],
  authors: [{ name: "AKTech Digital Solutions" }],
  openGraph: {
    title: "Acadivo — School Management & ERP Platform",
    description:
      "Manage your school's students, teachers, attendance, fees, examinations, timetables and daily operations with Acadivo.",
    url: "https://acadivo.com",
    siteName: "Acadivo ERP",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Acadivo — School Management & ERP Platform",
    description:
      "Manage your school's students, teachers, attendance, fees, examinations, timetables and daily operations with Acadivo.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen flex flex-col bg-white text-zinc-950 font-sans antialiased selection:bg-red-600 selection:text-white">
        <AuthProvider><AppChrome>{children}</AppChrome></AuthProvider>
      </body>
    </html>
  );
}
