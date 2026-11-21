// Supabase Edge Function entry point: POST /functions/v1/stylist-chat
// Body: { "message": "...", "conversation_id"?: "<uuid>", "user_id"?: "<uuid>" }
import { createHandler } from "./handler.ts";
import { createGemini } from "./gemini.ts";
import { createSupabaseDb } from "./db.ts";

const env = (name: string) => Deno.env.get(name) || undefined;

let handler: ((req: Request) => Promise<Response>) | null = null;

Deno.serve((req) => {
  if (!handler) {
    const url = env("SUPABASE_URL");
    // Supabase normally provides SUPABASE_SERVICE_ROLE_KEY. Custom secrets cannot start with "SUPABASE_",
    // so DB_SECRET_KEY is the fallback name you can set yourself.
    const secret = env("SUPABASE_SERVICE_ROLE_KEY") ?? env("DB_SECRET_KEY");
    const gemini = env("GEMINI_API_KEY");
    const missing = [!url && "SUPABASE_URL", !secret && "SUPABASE_SERVICE_ROLE_KEY or DB_SECRET_KEY", !gemini && "GEMINI_API_KEY"].filter(Boolean);
    if (missing.length) {
      return new Response(JSON.stringify({ error: { code: "missing_config", message: `Missing secrets: ${missing.join(", ")}` } }),
        { status: 500, headers: { "Content-Type": "application/json" } });
    }
    handler = createHandler(createSupabaseDb(url!, secret!), createGemini(gemini!, env("GEMINI_MODEL") ?? "gemini-2.5-flash"));
  }
  return handler(req);
});
