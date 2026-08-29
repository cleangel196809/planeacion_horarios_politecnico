import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import CoordinadorApp from "@/components/CoordinadorApp";

export default function CoordinadorPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol === "admin") redirect("/admin");
  if (user.rol === "decano") redirect("/decano");
  if (user.rol === "secretaria_academica") redirect("/secretaria");
  if (user.rol !== "coordinador") redirect("/login");
  return <CoordinadorApp user={user} />;
}
