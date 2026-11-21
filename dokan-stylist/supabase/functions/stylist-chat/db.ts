// Supabase implementation of the Db interface. Uses the SECRET (service-role) key, so it must only run on the server.
import { createClient } from "npm:@supabase/supabase-js@2";
import type { Audience } from "./rules.ts";
import { AUDIENCE_FILTER } from "./rules.ts";
import type { DbProduct } from "./logic.ts";
import type { Db, Msg, ShopRow } from "./handler.ts";

const PRODUCT_COLUMNS =
  "id,shop_id,name,category,custom_category,gender,age_group,colors,occasion_tags,image_urls,price,discount_price,variants,status";

export function createSupabaseDb(url: string, secretKey: string): Db {
  const sb = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const check = (error: { message: string } | null, what: string) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };

  return {
    async getConversation(id) {
      const { data, error } = await sb.from("ai_conversations").select("id,messages").eq("id", id).maybeSingle();
      check(error, "load conversation");
      return data ? { id: data.id, messages: (data.messages ?? []) as Msg[] } : null;
    },

    async saveConversation(row) {
      const fields = { user_id: row.user_id, messages: row.messages, budget: row.budget, bundle: row.bundle };
      if (row.id) {
        const { error } = await sb.from("ai_conversations").update(fields).eq("id", row.id);
        check(error, "update conversation");
        return row.id;
      }
      const { data, error } = await sb.from("ai_conversations").insert(fields).select("id").single();
      check(error, "create conversation");
      return data!.id as string;
    },

    async getProfile(userId) {
      const { data, error } = await sb.from("users").select("gender,age_group").eq("id", userId).maybeSingle();
      check(error, "load profile");
      return data ?? null;
    },

    async getProducts(audience: Audience) {
      const f = AUDIENCE_FILTER[audience];
      const { data, error } = await sb.from("products").select(PRODUCT_COLUMNS)
        .eq("status", "active").eq("age_group", f.age).in("gender", f.genders);
      check(error, "load products");
      return (data ?? []) as DbProduct[];
    },

    async getShops(ids) {
      const out = new Map<string, ShopRow>();
      if (ids.length === 0) return out;
      const { data, error } = await sb.from("shops").select("id,name,owner_id,verification_status").in("id", ids);
      check(error, "load shops");
      for (const s of data ?? []) out.set(s.id, { name: s.name, owner_id: s.owner_id, verified: s.verification_status === "verified" });
      return out;
    },

    async getFlaggedOwnerIds(ownerIds) {
      if (ownerIds.length === 0) return new Set<string>();
      const { data, error } = await sb.from("badges").select("user_id")
        .eq("status", "active").eq("role", "seller").gt("expires_at", new Date().toISOString()).in("user_id", ownerIds);
      check(error, "load badges");
      return new Set((data ?? []).map((b: { user_id: string }) => b.user_id));
    },
  };
}
