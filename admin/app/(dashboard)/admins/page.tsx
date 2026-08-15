import { createAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentAdminUsername } from "@/lib/adminSession";
import AdminsList, { type AdminUser } from "@/components/AdminsList";

export const dynamic = "force-dynamic";

type AdminUserRow = { id: string; username: string; created_at: string; last_login_at: string | null };

export default async function AdminsPage() {
  const admin = createAdminClient();
  const [{ data: rows }, currentUsername] = await Promise.all([
    admin.from("admin_users").select("id, username, created_at, last_login_at").order("created_at").returns<AdminUserRow[]>(),
    getCurrentAdminUsername(),
  ]);

  const admins: AdminUser[] = (rows ?? []).map((r) => ({
    id: r.id,
    username: r.username,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">管理者アカウント</h1>
      <AdminsList admins={admins} currentUsername={currentUsername} />
    </div>
  );
}
