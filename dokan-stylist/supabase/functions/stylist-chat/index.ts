// Supabase Edge Function entry point: POST /functions/v1/stylist-chat
// Body: { "message": "...", "conversation_id"?: "<uuid>", "user_id"?: "<uuid>" }
import { createHandler } from "./handler.ts";
import { createGemini, DEFAULT_MODELS } from "./gemini.ts";
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
    // GEMINI_MODELS="modelA,modelB,modelC" = try in this order. GEMINI_MODEL (one name) still works and goes first.
    const listed = (env("GEMINI_MODELS") ?? "").split(",").map((m) => m.trim()).filter(Boolean);
    const first = env("GEMINI_MODEL");
    const models = [...new Set([...(first ? [first] : []), ...(listed.length ? listed : DEFAULT_MODELS)])];
    handler = createHandler(createSupabaseDb(url!, secret!), createGemini(gemini!, models));
  }
  return handler(req);
});
