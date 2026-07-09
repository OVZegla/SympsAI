import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { NavLink } from "@/components/ui/NavLink";
import { SignOutButton } from "@/components/ui/SignOutButton";

const NAV = [
  { href: "/dashboard", label: "Accueil", icon: "🏠" },
  { href: "/incidents", label: "Incidents", icon: "🔧" },
  { href: "/search", label: "Recherche", icon: "🔍" },
  { href: "/machines", label: "Machines", icon: "🖨️" },
  { href: "/clients", label: "Clients", icon: "👥" },
  { href: "/documents", label: "Documents", icon: "📄" },
  { href: "/statistics", label: "Statistiques", icon: "📊" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const initial = (profile.full_name || profile.email).charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white p-4">
        <Link href="/dashboard" className="px-3 py-2">
          <p className="text-lg font-bold tracking-tight text-slate-900">
            SYMP&apos;S <span className="text-slate-400">AI</span>
          </p>
          <p className="text-xs text-slate-400">Assistant technique</p>
        </Link>

        <Link
          href="/incidents/new"
          className="mx-1 mt-4 rounded-lg bg-slate-900 px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-800"
        >
          + Décrire un problème
        </Link>

        <nav className="mt-5 flex-1 space-y-1">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
          {profile.role === "admin" && (
            <NavLink href="/admin" label="Admin" icon="⚙️" />
          )}
        </nav>

        <div className="border-t border-slate-100 px-2 pt-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">
                {profile.full_name || profile.email}
              </p>
              <p className="text-xs capitalize text-slate-400">{profile.role}</p>
            </div>
          </div>
          <div className="mt-2 pl-[42px]">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-slate-50">{children}</main>
    </div>
  );
}
