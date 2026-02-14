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

/**
 * 認証成功時にユーザー情報を保存 / 更新
 * ※ IP・UAは「最新のみ」
 */
export async function upsertUserAuth(
  userId,
  username,
  ipHash,
  uaHash
) {
  const { error } = await supabase
    .from("users")
    .upsert(
      {
        user_id: userId,
        username,
        ip_hash: ipHash,
        ua_hash: uaHash,
        last_seen: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );

  if (error) throw error;
}

/**
 * サブ垢判定用
 * IP + UA が両方一致したユーザーのみ返す
 * （誤爆防止）
 */
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

/**
 * 認証ログ
 * type 例:
 *  - auth_success
 *  - vpn_detected
 *  - rate_limited
 *  - sub_account_blocked
 */
export async function insertAuthLog(
  userId,
  type,
  detail
) {
  const { error } = await supabase
    .from("auth_logs")
    .insert({
      user_id: userId,
      type,
      detail,
      created_at: new Date().toISOString()
    });

  if (error) throw error;
}


/* =====================
   MODERATION LOGS
===================== */
export async function insertModerationLog({
  guildId,
  targetUserId,
  moderatorUserId,
  action,
  reason = null,
  durationMs = null
}) {
  // デバッグ用：ここで null になっていないか確認
  console.log("DB Insert Logic:", { guildId, targetUserId, action });

  const { error } = await supabase
    .from("moderation_logs")
    .insert({
      guild_id: guildId,            // ここを確実に渡す
      target_user_id: targetUserId, // ここを確実に渡す
      moderator_user_id: moderatorUserId,
      action: action,
      reason: reason,
      duration_ms: durationMs,
      created_at: new Date().toISOString()
    });

  if (error) throw error;
}


/* =====================
   TIMEOUT CONTINUATIONS
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

export async function insertPinned(
  channel_id,
  message_id,
  content,
  author_name
) {
  const { error } = await supabase
    .from("pinned_messages")
    .insert({
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

export async function upsertTimeoutContinuation({ guild_id, target_user_id, reason, target_until, next_apply_at }) {
  const { error } = await supabase
    .from('timeout_continuations')
    .upsert({
      guild_id,
      target_user_id,
      reason,
      target_until,
      next_apply_at,
      updated_at: new Date().toISOString()
    }, {
      // guild_id と target_user_id の組み合わせで重複を判断する場合
      onConflict: 'guild_id,target_user_id' 
    });

  if (error) {
    throw error;
  }
}

export async function deletePinned(channel_id) {
  const { error } = await supabase
    .from("pinned_messages")
    .delete()
    .eq("channel_id", channel_id);

  if (error) throw error;
}// 1. エラーの原因だった削除関数を定義・エクスポート
export async function deleteTimeoutContinuation(guildId, userId) {
  const { error } = await supabase
    .from('timeout_continuations') // テーブル名が異なる場合はここを修正してください
    .delete()
    .match({ 
      guild_id: guildId, 
      target_user_id: userId 
    });

  if (error) {
    throw error;
  }
}

export async function listDueTimeoutContinuations(now) {
  const { data, error } = await supabase
    .from('timeout_continuations')
    .select('*')
    .lt('next_apply_at', now); // 現在時刻より前のものを取得

  if (error) throw error;
  return data || [];
}
