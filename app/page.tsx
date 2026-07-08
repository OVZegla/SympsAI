import { redirect } from "next/navigation";

// The middleware already redirects unauthenticated users to /login, so the
// root simply forwards to the dashboard.
export default function Home() {
  redirect("/dashboard");
}
