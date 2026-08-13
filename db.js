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
    USERS & AUTH
===================== */
/* =====================
    AUTH JOBS
===================== */

/**
 * OAuth認証ジョブを作成
 *
 * OAuth codeは認証処理が終わるまで一時保存する。
 * expires_atはデフォルト5分。
 */
export async function createAuthJob({
  oauthCode,
  ip,
  ipHash,
  uaHash,
  expiresInMs = 5 * 60 * 1000
}) {
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + expiresInMs
  );

  const { data, error } = await supabase
    .from("auth_jobs")
    .insert({
      status: "processing",

      oauth_code: oauthCode,
      ip,
      ip_hash: ipHash,
      ua_hash: uaHash,

      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      expires_at: expiresAt.toISOString()
    })
    .select("id")
    .single();

  if (error) throw error;

  return data.id;
}


/**
 * 認証ジョブ取得
 */
export async function getAuthJob(jobId) {
  const { data, error } = await supabase
    .from("auth_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw error;

  return data ?? null;
}


/**
 * 認証ジョブ更新
 */
export async function updateAuthJob(
  jobId,
  updates
) {
  const {
    status,
    userId,
    username,
    errorCode,
    oauthCode,
    ip,
    ipHash,
    uaHash
  } = updates;

  const updateData = {
    updated_at: new Date().toISOString()
  };

  if (status !== undefined) {
    updateData.status = status;
  }

  if (userId !== undefined) {
    updateData.user_id = userId;
  }

  if (username !== undefined) {
    updateData.username = username;
  }

  if (errorCode !== undefined) {
    updateData.error_code = errorCode;
  }

  if (oauthCode !== undefined) {
    updateData.oauth_code = oauthCode;
  }

  if (ip !== undefined) {
    updateData.ip = ip;
  }

  if (ipHash !== undefined) {
    updateData.ip_hash = ipHash;
  }

  if (uaHash !== undefined) {
    updateData.ua_hash = uaHash;
  }

  const { error } = await supabase
    .from("auth_jobs")
    .update(updateData)
    .eq("id", jobId);

  if (error) throw error;
}


/**
 * OAuth codeを削除
 *
 * 認証が終わったらcodeを残さない。
 */
export async function clearAuthJobCode(jobId) {
  const { error } = await supabase
    .from("auth_jobs")
    .update({
      oauth_code: null,
      ip: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", jobId);

  if (error) throw error;
}


/**
 * 認証ジョブ削除
 */
export async function deleteAuthJob(jobId) {
  const { error } = await supabase
    .from("auth_jobs")
    .delete()
    .eq("id", jobId);

  if (error) throw error;
}


/**
 * 期限切れジョブ削除
 *
 * readyイベントやcronから定期的に呼んでもOK。
 */
export async function cleanupExpiredAuthJobs() {
  const { error } = await supabase
    .from("auth_jobs")
    .delete()
    .lt(
      "expires_at",
      new Date().toISOString()
    );

  if (error) throw error;
}

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

  if (error) throw error; // 呼び出し元でハンドリングできるよう throw を推奨
}

/* =====================
    MODERATION (WARN & LOGS)
===================== */

/**
 * 警告回数をインクリメント (RPCを使用しない場合、安全なインクリメントは以下)
 */
export async function addWarn(userId, amount = 1) {
  // Supabaseのupdateで直接加算（rpcを使わない場合）
  const { data, error: fetchError } = await supabase
    .from("users")
    .select("warn")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from("users")
    .update({ warn: (data?.warn ?? 0) + amount })
    .eq("user_id", userId);

  if (error) throw error;
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
    TIMEOUT CONTINUATIONS
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
    .upsert({
      guild_id: guildId,
      target_user_id: targetUserId,
      reason,
      target_until: targetUntil,
      next_apply_at: nextApplyAt,
      updated_at: new Date().toISOString()
    }, { 
      onConflict: "guild_id,target_user_id" 
    });

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
    .upsert({
      channel_id,
      message_id,
      content,
      author_name,
      updated_at: new Date().toISOString()
    }, { 
      onConflict: "channel_id" 
    });

  if (error) throw error;
}

export async function deletePinned(channel_id) {
  const { error } = await supabase
    .from("pinned_messages")
    .delete()
    .eq("channel_id", channel_id);

  if (error) throw error;
}
