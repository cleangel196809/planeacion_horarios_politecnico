import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import SecretariaApp from "@/components/SecretariaApp";

export default function SecretariaPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol === "admin") redirect("/admin");
  if (user.rol === "coordinador") redirect("/coordinador");
  if (user.rol === "decano") redirect("/decano");
  if (user.rol !== "secretaria_academica") redirect("/login");
  return <SecretariaApp user={user} />;
}
