import { signOut } from "@/app/(dashboard)/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="text-sm text-slate-500 hover:text-slate-800"
      >
        Se déconnecter
      </button>
    </form>
  );
}
