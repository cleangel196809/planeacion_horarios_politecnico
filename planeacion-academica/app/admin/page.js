import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import AdminApp from "@/components/AdminApp";

export default function AdminPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol === "coordinador") redirect("/coordinador");
  if (user.rol !== "admin") redirect("/decano");
  return <AdminApp user={user} />;
}
