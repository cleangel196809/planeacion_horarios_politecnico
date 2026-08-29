import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import DecanoApp from "@/components/DecanoApp";

export default function DecanoPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol === "admin") redirect("/admin");
  if (user.rol === "coordinador") redirect("/coordinador");
  if (user.rol === "secretaria_academica") redirect("/secretaria");
  if (user.rol !== "decano") redirect("/login");
  return <DecanoApp user={user} />;
}
