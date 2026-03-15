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

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Supabase env missing");
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

/* =====================
   USERS
===================== */

export async function upsertUserAuth(userId, username, ipHash, uaHash) {

  const { error } = await supabase
    .from("users")
    .upsert({
      user_id: userId,
      username: username,
      ip_hash: ipHash,
      ua_hash: uaHash,
      last_timestamp: new Date().toISOString()
    }, {
      onConflict: "user_id"
    });

  if (error) throw error;
}

export async function findUserByIPandUA(ipHash, uaHash) {

  const { data, error } = await supabase
    .from("users")
    .select("user_id")
    .eq("ip_hash", ipHash)
    .eq("ua_hash", uaHash)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data?.user_id ?? null;
}

/* =====================
   AUTH LOGS
===================== */

export async function insertAuthLog(userId, ipHash, uaHash, type, detail) {

  const { error } = await supabase
    .from("auth_logs")
    .insert({
      user_id: userId,
      ip_hash: ipHash,
      ua_hash: uaHash,
      type: type,
      detail: detail,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error("Auth log failed", error);
  }
}

/* =====================
   WARN
===================== */

export async function addWarn(userId, amount = 1) {

  const { data } = await supabase
    .from("users")
    .select("warn")
    .eq("user_id", userId)
    .maybeSingle();

  const warn = (data?.warn ?? 0) + amount;

  await supabase
    .from("users")
    .update({ warn })
    .eq("user_id", userId);
}

export async function insertModerationLog({
  guildId,
  targetUserId,
  moderatorUserId,
  action,
  reason = null,
  durationMs = null
}) {
  const { error } = await supabase
    .from("moderation_logs")
    .insert({
      guild_id: guildId,
      target_user_id: targetUserId,
      moderator_user_id: moderatorUserId,
      action,
      reason,
      duration_ms: durationMs,
      created_at: new Date().toISOString()
    });
  if (error) throw error;
}

/* =====================
   TIMEOUT CONTINUATIONS (タイムアウト継続)
===================== */

export async function upsertTimeoutContinuation({
  guildId,
  targetUserId,
  reason = null,
  targetUntil,
  nextApplyAt
}) {
  const { error } = await supabase
    .from("timeout_continuations")
    .upsert(
      {
        guild_id: guildId,
        target_user_id: targetUserId,
        reason,
        target_until: targetUntil,
        next_apply_at: nextApplyAt,
        updated_at: new Date().toISOString()
      },
      { onConflict: "guild_id,target_user_id" }
    );
  if (error) throw error;
}

export async function deleteTimeoutContinuation(guildId, targetUserId) {
  const { error } = await supabase
    .from("timeout_continuations")
    .delete()
    .eq("guild_id", guildId)
    .eq("target_user_id", targetUserId);
  if (error) throw error;
}

export async function listDueTimeoutContinuations(nowIso = new Date().toISOString()) {
  const { data, error } = await supabase
    .from("timeout_continuations")
    .select("*")
    .lte("next_apply_at", nowIso)
    .order("next_apply_at", { ascending: true })
    .limit(100);

  if (error) throw error;
  return data ?? [];
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
  return data ?? null;
}

export async function upsertPinned(channel_id, message_id, content, author_name) {
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
