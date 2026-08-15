import Link from "next/link";
import { createAdminClient } from "@/lib/supabaseAdmin";
import BroadcastForm, { type ScheduledBroadcast } from "@/components/BroadcastForm";

export const dynamic = "force-dynamic";

type ScheduledRow = { id: string; message: string; scheduled_at: string };

export default async function BroadcastPage() {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("scheduled_broadcasts")
    .select("id, message, scheduled_at")
    .is("sent_at", null)
    .order("scheduled_at")
    .returns<ScheduledRow[]>();

  const scheduled: ScheduledBroadcast[] = (rows ?? []).map((r) => ({
    id: r.id,
    message: r.message,
    scheduledAt: r.scheduled_at,
  }));

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">全体配信</h1>
        <Link href="/broadcast/history" className="text-sm text-white/50 underline">
          配信履歴
        </Link>
      </div>
      <BroadcastForm scheduled={scheduled} />
    </div>
  );
}
