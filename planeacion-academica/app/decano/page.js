import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import DecanoApp from "@/components/DecanoApp";

export default function DecanoPage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol !== "decano") redirect("/admin");
  return <DecanoApp user={user} />;
}
