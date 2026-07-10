import { createClient } from "@/lib/supabase/server";
import { createClientRecord } from "./actions";

interface ClientRow {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  machines: { count: number }[];
}

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900";

export default async function ClientsPage() {
  const supabase = createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, company_name, email, phone, machines(count)")
    .order("name")
    .returns<ClientRow[]>();

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Clients</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* List */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Société</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">Machines</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(clients ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.company_name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {c.machines?.[0]?.count ?? 0}
                  </td>
                </tr>
              ))}
              {(clients ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Aucun client. Ajoute-en un à droite.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Creation form */}
        <form
          action={createClientRecord}
          className="h-fit space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <h2 className="font-semibold text-slate-900">Nouveau client</h2>

          <label className="block text-sm font-medium text-slate-700">
            Nom *
            <input name="name" required className={inputClass} placeholder="Imprimerie Dupont" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Société
            <input name="company_name" className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input name="email" type="email" className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Téléphone
            <input name="phone" className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Notes
            <textarea name="notes" rows={2} className={inputClass} />
          </label>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Créer le client
          </button>
        </form>
      </div>
    </div>
  );
}
