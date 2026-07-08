"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={
        "block rounded-md px-3 py-2 text-sm font-medium " +
        (active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100")
      }
    >
      {label}
    </Link>
  );
}
