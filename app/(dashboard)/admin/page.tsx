import { requireProfile } from "@/lib/auth";
import { EmbeddingStatus } from "@/components/admin/EmbeddingStatus";

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
    <div className="space-y-6 p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Administration</h1>

      <EmbeddingStatus />

      <div className="max-w-md rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
        <p>
          Gestion des utilisateurs, machines, documents et validation des
          connaissances (spec §8). L&apos;ajout d&apos;utilisateurs s&apos;appuie
          sur Supabase Auth : un administrateur crée le compte, le profil est
          provisionné automatiquement (migration <code>0007_auth_profile.sql</code>).
        </p>
      </div>
    </div>
  );
}
