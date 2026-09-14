"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/discover", label: "Discover" },
  { href: "/professors", label: "Professors" },
  { href: "/queue", label: "Review Queue" },
  { href: "/sent", label: "Sent" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <aside className="bg-navy text-[#f6f0e6] px-5 py-6">
      <p className="text-xs uppercase tracking-[0.2em] text-[#c4b39a]">Local first</p>
      <h1 className="mt-2 font-semibold text-xl">ResearchReach</h1>
      <p className="mt-2 text-sm text-[#c4b39a]">Evidence-backed professor outreach</p>
      <nav className="mt-8 flex flex-col gap-1">
        {links.map((link) => {
          const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-3 py-2 text-sm ${active ? "bg-white/10 text-white" : "text-[#d7cbb8] hover:bg-white/5"}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
