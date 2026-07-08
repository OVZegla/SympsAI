import { requireProfile } from "@/lib/auth";
import { PhasePlaceholder } from "@/components/ui/PhasePlaceholder";

export default async function AdminPage() {
  const profile = await requireProfile();

  // Defense in depth: the nav hides this link for non-admins, but the page
  // must also refuse non-admins directly (spec §8).
  if (profile.role !== "admin") {
    return (
      <div className="p-8">
        <p className="text-slate-600">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  return (
    <PhasePlaceholder title="Administration" phase="En cours">
      <p>
        Gestion des utilisateurs, machines, documents et validation des
        connaissances (spec §8). L&apos;ajout d&apos;utilisateurs s&apos;appuie
        sur Supabase Auth : un administrateur crée le compte, le profil est
        provisionné automatiquement (migration <code>0007_auth_profile.sql</code>).
      </p>
    </PhasePlaceholder>
  );
}
