import { requireProfile } from "@/lib/auth";
import { NavLink } from "@/components/ui/NavLink";
import { SignOutButton } from "@/components/ui/SignOutButton";

const NAV = [
  { href: "/dashboard", label: "Assistant" },
  { href: "/incidents", label: "Incidents" },
  { href: "/machines", label: "Machines" },
  { href: "/clients", label: "Clients" },
  { href: "/documents", label: "Documents" },
  { href: "/statistics", label: "Statistiques" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white p-4">
        <div className="px-3 py-2">
          <p className="text-lg font-semibold text-slate-900">SYMP&apos;S AI</p>
          <p className="text-xs text-slate-400">Assistant technique</p>
        </div>

        <nav className="mt-6 flex-1 space-y-1">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
          {profile.role === "admin" && (
            <NavLink href="/admin" label="Admin" />
          )}
        </nav>

        <div className="border-t border-slate-100 px-3 pt-4">
          <p className="text-sm font-medium text-slate-800">
            {profile.full_name || profile.email}
          </p>
          <p className="mb-2 text-xs capitalize text-slate-400">
            {profile.role}
          </p>
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
