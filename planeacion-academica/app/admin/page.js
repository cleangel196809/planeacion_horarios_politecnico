import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import AdminApp from "@/components/AdminApp";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol === "coordinador") redirect("/coordinador");
  if (user.rol === "secretaria_academica") redirect("/secretaria");
  if (user.rol !== "admin") redirect("/decano");
  return <AdminApp user={user} />;
}
