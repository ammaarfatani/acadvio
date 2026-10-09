"use client";

import { useState } from "react";
import Link from "next/link";
import PublicLogo from "@/components/PublicLogo";
import { usePathname } from "next/navigation";
import { Menu, X, ShieldCheck, ArrowRight, ChevronRight } from "lucide-react";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { name: "Features", href: "/features" },
    { name: "Pricing", href: "/pricing" },
    { name: "Demo", href: "/demo" },
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 transition-all">
      {/* Top micro banner */}
      <div className="bg-zinc-950 text-white py-1.5 px-4 text-xs font-medium text-center flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-semibold uppercase tracking-wider">
          14-day trial
        </span>
        <span>Run your school in one connected workspace.</span>
        <Link href="/free-trial" className="inline-flex shrink-0 items-center underline hover:text-red-400 font-semibold gap-0.5">
          Try Free Now <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <PublicLogo className="w-32 sm:w-36"/>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200 rounded">SaaS</span>
              </div>
              <span className="text-[10px] text-zinc-500 tracking-wider font-medium uppercase -mt-0.5">
                by AKTech Digital
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-red-600 ${
                    isActive ? "text-red-600 font-semibold" : "text-zinc-600"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Right CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-zinc-800 hover:text-red-600 px-3 py-2 transition-colors"
            >
              Portal Login
            </Link>
            <Link
              href="/free-trial"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 px-4 py-2.5 rounded-lg shadow-sm hover:shadow transition-all group"
            >
              <span>Try Free Now</span>
              <ArrowRight className="w-4 h-4 text-red-500 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-zinc-700 hover:bg-zinc-100 focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-zinc-200 px-4 pt-2 pb-6 space-y-3">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2.5 rounded-lg text-base font-medium ${
                  pathname === link.href
                    ? "bg-red-50 text-red-600 font-semibold"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="pt-4 border-t border-zinc-200 flex flex-col gap-2.5">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-sm"
            >
              Portal Login
            </Link>
            <Link
              href="/free-trial"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 font-semibold text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              <span>Try Free Now</span>
              <ArrowRight className="w-4 h-4 text-red-500" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}






