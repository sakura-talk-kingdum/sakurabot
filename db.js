import pg from "pg";

// pg.Pool の初期化
const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      user: process.env.PGUSER,
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      password: process.env.PGPASSWORD,
      port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
    };

export const db = new pg.Pool(poolConfig);

/**
 * 既存の Supabase メソッドチェーンを pg (SQL) に自動変換するラッパー
 */
class SupabaseToPgWrapper {
  constructor(tableName) {
    this.tableName = tableName;
    this.fields = "*";
    this.whereClauses = [];
    this.params = [];
    this.paramIndex = 1;
    this.orderByClause = "";
    this.limitClause = "";
  }

  // .select("id, name")
  select(fields = "*") {
    this.fields = fields;
    return this;
  }

  // .eq("guild_id", value)
  eq(column, value) {
    this.whereClauses.push(`${column} = $${this.paramIndex++}`);
    this.params.push(value);
    return this;
  }

  // .ilike("name", "%value%")
  ilike(column, pattern) {
    this.whereClauses.push(`${column} ILIKE $${this.paramIndex++}`);
    this.params.push(pattern);
    return this;
  }

  // .order("created_at", { ascending: false })
  order(column, options = { ascending: true }) {
    const dir = options.ascending ? "ASC" : "DESC";
    this.orderByClause = `ORDER BY ${column} ${dir}`;
    return this;
  }

  // .limit(10)
  limit(count) {
    this.limitClause = `LIMIT ${count}`;
    return this;
  }

  // await で呼び出されたときに自動でSQLを実行する魔法のメソッド
  async then(onfulfilled, onrejected) {
    let sql = `SELECT ${this.fields} FROM ${this.tableName}`;
    
    if (this.whereClauses.length > 0) {
      sql += ` WHERE ${this.whereClauses.join(" AND ")}`;
    }
    if (this.orderByClause) sql += ` ${this.orderByClause}`;
    if (this.limitClause) sql += ` ${this.limitClause}`;

    try {
      const res = await db.query(sql, this.params);
      // Supabaseの戻り値オブジェクト { data, error } を完全に再現
      return onfulfilled({ data: res.rows, error: null });
    } catch (error) {
      if (onrejected) return onrejected(error);
      return onfulfilled({ data: null, error: error });
    }
  }
}

// 既存のコードが「supabase.from("テーブル名")」の形で呼べるようにするダミーオブジェクト
export const supabase = {
  from: (tableName) => new SupabaseToPgWrapper(tableName)
};


/* =====================
    USERS & AUTH
===================== */
/* =====================
    AUTH JOBS
===================== */

/**
 * OAuth認証ジョブを作成
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

  const query = `
    INSERT INTO auth_jobs (
      status, oauth_code, ip, ip_hash, ua_hash, created_at, updated_at, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;
  `;

  const values = [
    "processing",
    oauthCode,
    ip,
    ipHash,
    uaHash,
    now.toISOString(),
    now.toISOString(),
    expiresAt.toISOString()
  ];

  try {
    const res = await db.query(query, values);
    return res.rows.id;
  } catch (error) {
    throw error;
  }
}

/**
 * 認証ジョブ取得
 */
export async function getAuthJob(jobId) {
  const query = `
    SELECT * FROM auth_jobs 
    WHERE id = $1 
    LIMIT 1;
  `;

  try {
    const res = await db.query(query, [jobId]);
    return res.rows ?? null;
  } catch (error) {
    throw error;
  }
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

  const fields = ["updated_at = \$1"];
  const values = [new Date().toISOString()];
  let index = 2;

  if (status !== undefined) { fields.push(`status = $${index++}`); values.push(status); }
  if (userId !== undefined) { fields.push(`user_id = $${index++}`); values.push(userId); }
  if (username !== undefined) { fields.push(`username = $${index++}`); values.push(username); }
  if (errorCode !== undefined) { fields.push(`error_code = $${index++}`); values.push(errorCode); }
  if (oauthCode !== undefined) { fields.push(`oauth_code = $${index++}`); values.push(oauthCode); }
  if (ip !== undefined) { fields.push(`ip = $${index++}`); values.push(ip); }
  if (ipHash !== undefined) { fields.push(`ip_hash = $${index++}`); values.push(ipHash); }
  if (uaHash !== undefined) { fields.push(`ua_hash = $${index++}`); values.push(uaHash); }

  values.push(jobId);
  const query = `
    UPDATE auth_jobs 
    SET ${fields.join(", ")} 
    WHERE id = $${index};
  `;

  try {
    await db.query(query, values);
  } catch (error) {
    throw error;
  }
}

/**
 * OAuth codeを削除
 */
export async function clearAuthJobCode(jobId) {
  const query = `
    UPDATE auth_jobs 
    SET oauth_code = NULL, ip = NULL, updated_at = $1 
    WHERE id = $2;
  `;

  try {
    await db.query(query, [new Date().toISOString(), jobId]);
  } catch (error) {
    throw error;
  }
}

/**
 * 認証ジョブ削除
 */
export async function deleteAuthJob(jobId) {
  const query = `
    DELETE FROM auth_jobs 
    WHERE id = $1;
  `;

  try {
    await db.query(query, [jobId]);
  } catch (error) {
    throw error;
  }
}

/**
 * 期限切れジョブ削除
 */
export async function cleanupExpiredAuthJobs() {
  const query = `
    DELETE FROM auth_jobs 
    WHERE expires_at < $1;
  `;

  try {
    await db.query(query, [new Date().toISOString()]);
  } catch (error) {
    throw error;
  }
}

export async function upsertUserAuth(userId, username, ipHash, uaHash) {
  const query = `
    INSERT INTO users (user_id, username, ip_hash, ua_hash, last_timestamp)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      username = EXCLUDED.username,
      ip_hash = EXCLUDED.ip_hash,
      ua_hash = EXCLUDED.ua_hash,
      last_timestamp = EXCLUDED.last_timestamp;
  `;

  const values = [userId, username, ipHash, uaHash, new Date().toISOString()];

  try {
    await db.query(query, values);
  } catch (error) {
    throw error;
  }
}

export async function findUserByIPandUA(ipHash, uaHash) {
  const query = `
    SELECT user_id FROM users 
    WHERE ip_hash = $1 AND ua_hash = $2 
    LIMIT 1;
  `;

  try {
    const res = await db.query(query, [ipHash, uaHash]);
    return res.rows?.user_id ?? null;
  } catch (error) {
    throw error;
  }
}

export async function insertAuthLog(userId, ipHash, uaHash, type, detail) {
  const query = `
    INSERT INTO auth_logs (user_id, ip_hash, ua_hash, type, detail, created_at)
    VALUES ($1, $2, $3, $4, $5, $6);
  `;

  const values = [userId, ipHash, uaHash, type, detail, new Date().toISOString()];

  try {
    await db.query(query, values);
  } catch (error) {
    throw error;
  }
}

/* =====================
    MODERATION (WARN & LOGS)
===================== */

/**
 * 警告回数をインクリメント
 */
export async function addWarn(userId, amount = 1) {
  const query = `
    UPDATE users 
    SET warn = COALESCE(warn, 0) + $1 
    WHERE user_id = $2;
  `;

  try {
    await db.query(query, [amount, userId]);
  } catch (error) {
    throw error;
  }
}

export async function insertModerationLog({
  guildId,
  targetUserId,
  moderatorUserId,
  action,
  reason = null,
  durationMs = null
}) {
  const query = `
    INSERT INTO moderation_logs (
      guild_id, target_user_id, moderator_user_id, action, reason, duration_ms, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7);
  `;

  const values = [
    guildId, 
    targetUserId, 
    moderatorUserId, 
    action, 
    reason, 
    durationMs, 
    new Date().toISOString()
  ];

  try {
    await db.query(query, values);
  } catch (error) {
    throw error;
  }
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
  const query = `
    INSERT INTO timeout_continuations (
      guild_id, target_user_id, reason, target_until, next_apply_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (guild_id, target_user_id) 
    DO UPDATE SET 
      reason = EXCLUDED.reason,
      target_until = EXCLUDED.target_until,
      next_apply_at = EXCLUDED.next_apply_at,
      updated_at = EXCLUDED.updated_at;
  `;

  const values = [guildId, targetUserId, reason, targetUntil, nextApplyAt, new Date().toISOString()];

  try {
    await db.query(query, values);
  } catch (error) {
    throw error;
  }
}

export async function deleteTimeoutContinuation(guildId, targetUserId) {
  const query = `
    DELETE FROM timeout_continuations 
    WHERE guild_id = $1 AND target_user_id = $2;
  `;

  try {
    await db.query(query, [guildId, targetUserId]);
  } catch (error) {
    throw error;
  }
}

export async function listDueTimeoutContinuations(nowIso = new Date().toISOString()) {
  const query = `
    SELECT * FROM timeout_continuations 
    WHERE next_apply_at <= $1 
    ORDER BY next_apply_at ASC 
    LIMIT 100;
  `;

  try {
    const res = await db.query(query, [nowIso]);
    return res.rows ?? [];
  } catch (error) {
    throw error;
  }
}

/* =====================
    PINNED MESSAGES
===================== */

export async function getPinnedByChannel(channel_id) {
  const query = `
    SELECT * FROM pinned_messages 
    WHERE channel_id = $1 
    LIMIT 1;
  `;

  try {
    const res = await db.query(query, [channel_id]);
    return res.rows ?? null;
  } catch (error) {
    throw error;
  }
}

export async function upsertPinned(channel_id, message_id, content, author_name) {
  const query = `
    INSERT INTO pinned_messages (channel_id, message_id, content, author_name, updated_at)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (channel_id) 
    DO UPDATE SET 
      message_id = EXCLUDED.message_id,
      content = EXCLUDED.content,
      author_name = EXCLUDED.author_name,
      updated_at = EXCLUDED.updated_at;
  `;

  const values = [channel_id, message_id, content, author_name, new Date().toISOString()];

  try {
    await db.query(query, values);
  } catch (error) {
    throw error;
  }
}

export async function deletePinned(channel_id) {
  const query = `
    DELETE FROM pinned_messages 
    WHERE channel_id = $1;
  `;

  try {
    await db.query(query, [channel_id]);
  } catch (error) {
    throw error;
  }
}
