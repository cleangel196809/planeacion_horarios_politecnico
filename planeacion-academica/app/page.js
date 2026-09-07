import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol === "admin") redirect("/admin");
  if (user.rol === "coordinador") redirect("/coordinador");
  if (user.rol === "secretaria_academica") redirect("/secretaria");
  redirect("/decano");
}
