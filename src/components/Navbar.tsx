"use client";
import { Presence } from "./Motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight } from "lucide-react";
import PublicLogo from "@/components/PublicLogo";
import {LocationSelector} from "./MarketSelector";
export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = [
    ["Features", "/features"],
    ["Pricing", "/pricing"],
    ["Demo", "/demo"],
    ["Portal guide", "/guide"],
    ["About", "/about"],
    ["Contact", "/contact"],
  ];
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  return (
    <header className="m-navigation">
      <div className="m-announcement">
        <span>Portal guides & setup guidance included.</span>
        <Link href="/free-trial">
          Try Free Now <ArrowRight size={13} />
        </Link>
        <span className="m-announcement-note">
          14-day trial · Approval required
        </span>
      </div>
      <div className="m-wrap m-nav-row">
        <Link href="/" aria-label="Acadivo home">
          <PublicLogo className="w-36 sm:w-40" />
        </Link>
        <nav aria-label="Main navigation" className="m-desktop-nav">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="m-nav-actions"><LocationSelector/>
          <Link href="/login">Portal login</Link>
          <Link href="/free-trial" className="m-button">
            Start Free Trial <ArrowRight size={15} />
          </Link>
        </div>
        <button
          className="m-menu-toggle"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="public-mobile-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <Presence show={open} kind="popover">
        <nav
          id="public-mobile-nav"
          aria-label="Mobile navigation"
          className="m-mobile-nav"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              document
                .querySelector<HTMLButtonElement>(".m-menu-toggle")
                ?.focus();
            }
          }}
        >
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)}>
            Portal login
          </Link>
          <Link
            href="/free-trial"
            className="m-button"
            onClick={() => setOpen(false)}
          >
            Try Free Now <ArrowRight size={15} />
          </Link>
        </nav>
      </Presence>
    </header>
  );
}
