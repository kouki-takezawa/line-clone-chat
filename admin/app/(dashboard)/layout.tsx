import AdminShell from "@/components/AdminShell";
import { getCurrentAdminUsername } from "@/lib/adminSession";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const username = await getCurrentAdminUsername();
  return <AdminShell username={username}>{children}</AdminShell>;
}
