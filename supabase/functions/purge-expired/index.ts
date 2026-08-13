// Deletes messages (and their Storage images) older than 24 hours.
// Scheduled via pg_cron every 15 minutes (see supabase/post_deploy.sql).
// Deployed with --no-verify-jwt since pg_cron calls it without a user JWT;
// a shared secret header guards it from being called by anyone else.
import { createClient } from "npm:@supabase/supabase-js@2";

const TTL_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  const secret = Deno.env.get("FUNCTION_SECRET");
  if (secret && req.headers.get("x-function-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - TTL_MS).toISOString();

  const { data: expired, error } = await supabase
    .from("messages")
    .select("id, image_path")
    .lt("created_at", cutoff);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!expired || expired.length === 0) {
    return new Response(JSON.stringify({ purged: 0 }), { status: 200 });
  }

  const imagePaths = expired
    .map((m) => m.image_path)
    .filter((p): p is string => !!p);

  if (imagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("chat-images")
      .remove(imagePaths);
    if (storageError) {
      // Don't block row deletion on a storage cleanup failure — an orphaned
      // file is self-limiting (1GB free cap) and will be retried never, but
      // a stuck row would block future purges forever.
      console.error("storage cleanup error", storageError);
    }
  }

  const ids = expired.map((m) => m.id);
  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .in("id", ids);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ purged: ids.length }), { status: 200 });
});
