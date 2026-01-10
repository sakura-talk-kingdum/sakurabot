// db.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_URL or SUPABASE_SERVICE_KEY is not set");
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

/* =====================
   USERS (AUTH + PROFILE)
===================== */
export async function upsertUserAuth(
  userId,
  username,
  ipHash,
  uaHash
) {
  const { error } = await supabase.from("users").upsert({
    user_id: userId,
    username,
    ip_hash: ipHash,
    ua_hash: uaHash,
    last_seen: new Date().toISOString()
  });
  if (error) throw error;
}

export async function findUserByIPorUA(ipHash, uaHash) {
  const { data, error } = await supabase
    .from("users")
    .select("user_id")
    .or(`ip_hash.eq.${ipHash},ua_hash.eq.${uaHash}`)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.user_id ?? null;
}

/* =====================
   AUTH LOGS（唯一）
===================== */
export async function insertAuthLog(userId, type, detail) {
  const { error } = await supabase.from("auth_logs").insert({
    user_id: userId,
    type,
    detail
  });
  if (error) throw error;
}

/* =====================
   PINNED MESSAGES
===================== */
export async function getPinnedByChannel(channel_id) {
  const { data, error } = await supabase
    .from("pinned_messages")
    .select("*")
    .eq("channel_id", channel_id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function insertPinned(
  channel_id,
  message_id,
  content,
  author_name
) {
  const { error } = await supabase.from("pinned_messages").insert({
    channel_id,
    message_id,
    content,
    author_name
  });
  if (error) throw error;
}

export async function upsertPinned(
  channel_id,
  message_id,
  content,
  author_name
) {
  const { error } = await supabase
    .from("pinned_messages")
    .upsert(
      {
        channel_id,
        message_id,
        content,
        author_name,
        updated_at: new Date().toISOString()
      },
      { onConflict: "channel_id" }
    );
  if (error) throw error;
}

export async function deletePinned(channel_id) {
  const { error } = await supabase
    .from("pinned_messages")
    .delete()
    .eq("channel_id", channel_id);

  if (error) throw error;
}
