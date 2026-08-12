// bot.js
import crypto from 'crypto';
import fetch from 'node-fetch';
import {
  Client,
  GatewayIntentBits,
  AuditLogEvent,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionsBitField,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Collection,
  Partials,
  ChannelType
} from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  StreamType
} from '@discordjs/voice';
import path from "path";
import { fileURLToPath } from "url";
import ytdl from 'ytdl-core';
import playdl from 'play-dl';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import si from 'systeminformation';
import os from 'os';
import pidusage from 'pidusage';
import cron from "node-cron";
import { createUserAccount, deleteUserAccount, transferUserAccount,fetchUserAccount, addUserExperience, calculateUserLevel } from "./account.js";
import { startRecord, stopRecord } from "./record.js";
import {
  supabase,
  upsertUserAuth,
  findUserByIPandUA,
  insertAuthLog,
  insertModerationLog,
  upsertTimeoutContinuation,
  deleteTimeoutContinuation,
  listDueTimeoutContinuations,
  getPinnedByChannel,
  upsertPinned,
  deletePinned,
  addWarn

} from "./db.js";
import { commands } from "./lib/command/command.js";
import { handleInteractionCreate } from "./lib/interaction/interactionCreate.js";

import { HfInference } from "@huggingface/inference";

const inference = new HfInference(process.env.HF_TOKEN);
const width = 400;
const height = 400;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

const {
  DISCORD_BOT_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_GUILD_ID,
  DISCORD_ROLE_ID,
  DISCORD_CHAT_CHANNEL_ID,
  DISCORD_MOD_LOG_CHANNEL_ID,
  VPN_API_KEY,
  REDIRECT_URI,
  shiikurole,
  GAS_PROXY_URL,
  GAS_SECRET_KEY
} = process.env;

if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID || !DISCORD_ROLE_ID || !VPN_API_KEY || !REDIRECT_URI) {
  throw new Error('環境変数が足りてないよ！');
}

const DISCORD_LOG_CHANNEL_ID = "1208987840462200882";
const queues = new Map();

const AI_CHANNEL_ID = "1450782867335549031";
const COOLDOWN = 3 * 1000; // 3秒
const rateLimit = new Map();

const CHANNEL_COOLDOWN_MS = 60 * 1000; // 60秒
const ALLOWED_CHANNEL_IDS = [
  "123456789012345678", // #imihubun
  "987654321098765432"
];

const channelCooldowns = new Map();

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.Channel, // DMチャンネルを認識するために必須
    Partials.Message, // DMメッセージを認識するために必須
  ],
  rest: {
    rejectOnRateLimit: (info) => {
      console.warn('🚨 Rate limit hit!', info);
      return true;
    }
  }
});


const DISCORD_TIMEOUT_MAX_MS = 28 * 24 * 60 * 60 * 1000;

function parseDurationDetailed(str) {
  // max, w を正規表現に追加。特定の日にち(2025-12-31等)にもマッチするよう修正
  const regex = /(\d{4}-\d{2}-\d{2})|(\d+)\s*(max|w|d|h|m|s)/gi
  let ms = 0
  let usedMax = false

  for (const m of str.matchAll(regex)) {
    if (m[1]) {
      const target = new Date(m[1]).setHours(0, 0, 0, 0);
      const diff = target - Date.now();
      if (diff > 0) ms += diff;
      continue;
    }

    const v = m[2] ? Number(m[2]) : 1; // 数字がない場合は 1 とみなす
    const u = m[3].toLowerCase();
    
    if (u === 'max') { ms += DISCORD_TIMEOUT_MAX_MS; usedMax = true; }
    else if (u === 'w') ms += v * 604800000
    else if (u === 'd') ms += v * 86400000
    else if (u === 'h') ms += v * 3600000
    else if (u === 'm') ms += v * 60000
    else if (u === 's') ms += v * 1000
  }

  const now = Date.now();
  const cappedMs = Math.min(ms, DISCORD_TIMEOUT_MAX_MS);

  return {
    totalMs: ms,
    cappedMs,
    usedMax,
    targetUntil: ms > 0 ? new Date(now + ms).toISOString() : null,
    nextApplyAt: ms > DISCORD_TIMEOUT_MAX_MS && !usedMax
      ? new Date(now + DISCORD_TIMEOUT_MAX_MS).toISOString()
      : null
  };
}

function parseDuration(str) {
  return parseDurationDetailed(str).cappedMs
}

function formatDurationMs(ms) {
  if (!ms || ms <= 0) return "0秒";
  const totalSec = Math.floor(ms / 1000);
  const day = Math.floor(totalSec / 86400);
  const hour = Math.floor((totalSec % 86400) / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;

  return [
    day ? `${day}日` : null,
    hour ? `${hour}時間` : null,
    min ? `${min}分` : null,
    sec ? `${sec}秒` : null
  ].filter(Boolean).join(" ");
}

async function shouldSkipModerationTarget(guild, targetId, targetMember) {
  if (!shiikurole || !guild) return false;

  if (targetMember?.roles?.cache?.has(shiikurole)) {
    return true;
  }

  if (!targetId) return false;

  try {
    const member = await guild.members.fetch(targetId);
    return member.roles.cache.has(shiikurole);
  } catch {
    return false;
  }
}

export async function logModerationAction({ guild, action, target, moderator, reason, durationMs, targetMember }) {
  if (!guild || !target?.id) return;

  if (await shouldSkipModerationTarget(guild, target.id, targetMember)) {
    return;
  }

  try {
    await insertModerationLog({
      guildId: guild.id,
      targetUserId: target.id,
      moderatorUserId: moderator?.id ?? null,
      action,
      reason: reason ?? null,
      durationMs: durationMs ?? null
    });
  } catch (err) {
    console.error("mod log db insert failed:", err);
  }

  if (!DISCORD_MOD_LOG_CHANNEL_ID) return;

  try {
    const channel = await guild.channels.fetch(DISCORD_MOD_LOG_CHANNEL_ID);
    if (!channel?.isTextBased()) return;

    const fields = [
      { name: "Action", value: action, inline: true },
      { name: "Target", value: `${target?.tag ?? "Unknown"} (${target?.id ?? "-"})`, inline: true },
      { name: "Moderator", value: moderator ? `${moderator.tag} (${moderator.id})` : "Unknown", inline: true }
    ];

    if (durationMs) {
      fields.push({ name: "Duration", value: formatDurationMs(durationMs), inline: true });
    }

    if (reason) {
      fields.push({ name: "Reason", value: reason.slice(0, 1024) });
    }

    const embed = new EmbedBuilder()
      .setTitle("🛡️ Moderation Log")
      .setColor(0xff8855)
      .addFields(fields)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("mod log send failed:", err);
  }
}

async function scheduleTimeoutContinuation({ guildId, userId, reason, targetUntil, nextApplyAt }) {
  if (!guildId || !userId || !targetUntil || !nextApplyAt) {
    console.warn("timeout continuation skipped: missing required fields", {
      guildId,
      userId,
      hasTargetUntil: Boolean(targetUntil),
      hasNextApplyAt: Boolean(nextApplyAt)
    });
    return;
  }

  try {
    await upsertTimeoutContinuation({
      guildId,
      targetUserId: userId,
      reason: reason ?? null,
      targetUntil,
      nextApplyAt
    });
  } catch (err) {
    console.error("timeout continuation save failed:", err);
  }
}

async function clearTimeoutContinuation(guildId, userId) {
  if (!guildId || !userId) return;

  try {
    await deleteTimeoutContinuation(guildId, userId);
  } catch (err) {
    console.error("timeout continuation delete failed:", err);
  }
}

let processingTimeoutContinuations = false;
async function processDueTimeoutContinuations() {
  if (processingTimeoutContinuations) return;
  processingTimeoutContinuations = true;

  try {
    const jobs = await listDueTimeoutContinuations(new Date().toISOString());

    for (const job of jobs) {
      try {
        const guild = await client.guilds.fetch(job.guild_id);
        const member = await guild.members.fetch(job.target_user_id);

        if (await shouldSkipModerationTarget(guild, member.id, member)) {
          await clearTimeoutContinuation(job.guild_id, job.target_user_id);
          continue;
        }

        const remaining = new Date(job.target_until).getTime() - Date.now();
        if (remaining <= 0) {
          await clearTimeoutContinuation(job.guild_id, job.target_user_id);
          continue;
        }

        const applyMs = Math.min(remaining, DISCORD_TIMEOUT_MAX_MS);
        await member.timeout(applyMs, job.reason ?? "長期タイムアウト継続");

        if (remaining > DISCORD_TIMEOUT_MAX_MS) {
          const nextApplyAt = new Date(Date.now() + applyMs + 1_000).toISOString();
          await scheduleTimeoutContinuation({
            guildId: guild.id,
            userId: member.id,
            reason: job.reason,
            targetUntil: job.target_until,
            nextApplyAt
          });
        } else {
          await clearTimeoutContinuation(job.guild_id, job.target_user_id);
        }
      } catch (err) {
        // ★ ここを修正：ユーザーがサーバーにいない(10007)場合はデータを削除
        if (err.code === 10007) {
          console.warn(`[Timeout] ユーザー ${job.target_user_id} がサーバー ${job.guild_id} に存在しないため、データを削除します。`);
          await deleteTimeoutContinuation(job.guild_id, job.target_user_id);
        } else {
          // それ以外のエラーは従来通りログに出力
          console.error("timeout continuation process failed:", err);
        }
      }
    }
  } catch (err) {
    console.error("timeout continuation batch failed:", err);
  } finally {
    processingTimeoutContinuations = false;
  }
}

async function fetchLatestAuditLog(guild, type) {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 1 });
    return logs.entries.first() ?? null;
  } catch {
    return null;
  }
}

/* =====================
   RATE LIMIT
===================== */

const rateMap = new Map();

function checkRateLimit(key) {

  const now = Date.now();
  const limit = 5;
  const windowMs = 60000;

  const arr = (rateMap.get(key) || [])
    .filter(t => now - t < windowMs);

  arr.push(now);

  rateMap.set(key, arr);

  return arr.length <= limit;
}

/* =========================================================
   ERROR
========================================================= */

class AuthError extends Error {
  constructor(code, message, cause = null) {
    super(message);

    this.name = "AuthError";
    this.code = code;
    this.cause = cause;
  }
}

/*
 * ユーザーに返すエラーコード
 *
 * AUTH-001  認証情報不足
 * AUTH-002  レート制限
 * AUTH-003  VPN / Proxy / Tor / Relay
 * AUTH-004  サブアカウント
 * AUTH-005  Discord Token取得失敗
 * AUTH-006  Discordユーザー取得失敗
 * AUTH-007  Discordクライアント異常
 * AUTH-008  Discordサーバー取得失敗
 * AUTH-009  Discordメンバー取得失敗
 * AUTH-010  ロール付与失敗
 * AUTH-011  DB処理失敗
 * AUTH-012  MODログ失敗
 * AUTH-013  VPN APIエラー
 * AUTH-014  OAuth設定エラー
 * AUTH-015  GAS Proxyエラー
 * AUTH-999  不明なエラー
 */

/* =========================================================
   UTILS
========================================================= */

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}

function normalizeIP(ip) {
  if (!ip) return null;

  ip = String(ip).trim();

  if (ip.startsWith("::ffff:")) {
    return ip.slice(7);
  }

  if (ip === "::1") {
    return "127.0.0.1";
  }

  return ip;
}

function extractIP(req) {
  const forwarded = req.headers?.["x-forwarded-for"];

  if (forwarded) {
    const firstIP = String(forwarded)
      .split(",")[0]
      .trim();

    return normalizeIP(firstIP);
  }

  return normalizeIP(
    req.socket?.remoteAddress
  );
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/* =========================================================
   SAFE ERROR
========================================================= */

function toAuthError(error) {
  if (error instanceof AuthError) {
    return error;
  }

  console.error(
    "Unhandled authentication error:",
    error
  );

  return new AuthError(
    "AUTH-999",
    "Unknown authentication error",
    error
  );
}

/* =========================================================
   VPN CHECK
========================================================= */

async function checkVPN(ip) {
  if (!ip) {
    throw new AuthError(
      "AUTH-013",
      "IP address unavailable"
    );
  }

  if (!VPN_API_KEY) {
    throw new AuthError(
      "AUTH-013",
      "VPN_API_KEY is not configured"
    );
  }

  try {
    const url =
      `https://vpnapi.io/api/${encodeURIComponent(ip)}` +
      `?key=${encodeURIComponent(VPN_API_KEY)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new AuthError(
        "AUTH-013",
        `VPN API returned HTTP ${response.status}`
      );
    }

    const data = await response.json();

    const security = data?.security;

    const detected = Boolean(
      security?.vpn ||
      security?.proxy ||
      security?.tor ||
      security?.relay
    );

    return {
      blocked: detected,
      reason: detected
        ? "vpn/proxy/tor/relay detected"
        : "clean",
      data,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError(
      "AUTH-013",
      "VPN API request failed",
      error
    );
  }
}

/* =========================================================
   GAS PROXY
========================================================= */

async function gasRequest(url, options = {}) {
  if (!GAS_PROXY_URL) {
    throw new AuthError(
      "AUTH-014",
      "GAS_PROXY_URL is not configured"
    );
  }

  if (!GAS_SECRET_KEY) {
    throw new AuthError(
      "AUTH-014",
      "GAS_SECRET_KEY is not configured"
    );
  }

  try {
    const response = await fetch(
      GAS_PROXY_URL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        body: JSON.stringify({
          secret_key: GAS_SECRET_KEY,

          url,

          options: {
            method:
              options.method || "GET",

            headers:
              options.headers || {},

            ...(options.body !== undefined
              ? {
                  body: options.body,
                }
              : {}),
          },
        }),
      }
    );

    if (!response.ok) {
      throw new AuthError(
        "AUTH-015",
        `GAS Proxy HTTP ${response.status}`
      );
    }

    let data;

    try {
      data = await response.json();
    } catch (error) {
      throw new AuthError(
        "AUTH-015",
        "Invalid GAS Proxy JSON response",
        error
      );
    }

    if (data?.status !== 200) {
      throw new AuthError(
        "AUTH-015",
        `GAS Proxy returned ${data?.status ?? "unknown"}: ${
          data?.body ||
          data?.error ||
          "unknown error"
        }`
      );
    }

    if (
      typeof data.body !== "string"
    ) {
      throw new AuthError(
        "AUTH-015",
        "Invalid GAS Proxy response body"
      );
    }

    try {
      return JSON.parse(data.body);
    } catch (error) {
      throw new AuthError(
        "AUTH-015",
        "Failed to parse Discord API response",
        error
      );
    }
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError(
      "AUTH-015",
      "GAS Proxy request failed",
      error
    );
  }
}

/* =========================================================
   DISCORD TOKEN
========================================================= */

async function exchangeDiscordCode(code) {
  if (
    !DISCORD_CLIENT_ID ||
    !DISCORD_CLIENT_SECRET ||
    !REDIRECT_URI
  ) {
    throw new AuthError(
      "AUTH-014",
      "Discord OAuth configuration is incomplete"
    );
  }

  const basic = Buffer
    .from(
      `${DISCORD_CLIENT_ID}:${DISCORD_CLIENT_SECRET}`
    )
    .toString("base64");

  const body = new URLSearchParams({
    grant_type:
      "authorization_code",

    code,

    redirect_uri:
      REDIRECT_URI,
  }).toString();

  const token = await gasRequest(
    "https://discord.com/api/v10/oauth2/token",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",

        Authorization:
          `Basic ${basic}`,
      },

      body,
    }
  );

  if (!token?.access_token) {
    throw new AuthError(
      "AUTH-005",
      "Discord token was not returned"
    );
  }

  return token;
}

/* =========================================================
   DISCORD USER
========================================================= */

async function getDiscordUser(accessToken) {
  try {
    const user = await gasRequest(
      "https://discord.com/api/v10/users/@me",
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },
      }
    );

    if (!user?.id) {
      throw new AuthError(
        "AUTH-006",
        "Discord user ID was not returned"
      );
    }

    return user;
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === "AUTH-015") {
        throw new AuthError(
          "AUTH-006",
          "Discord user request failed",
          error
        );
      }

      throw error;
    }

    throw new AuthError(
      "AUTH-006",
      "Discord user request failed",
      error
    );
  }
}

/* =========================================================
   DISCORD GUILD
========================================================= */

async function fetchGuild(client) {
  if (!client) {
    throw new AuthError(
      "AUTH-007",
      "Discord client is unavailable"
    );
  }

  if (!client.guilds) {
    throw new AuthError(
      "AUTH-007",
      "Discord guild manager is unavailable"
    );
  }

  for (
    let attempt = 1;
    attempt <= 5;
    attempt++
  ) {
    try {
      let guild =
        client.guilds.cache.get(
          GUILD_ID
        );

      if (!guild) {
        guild =
          await client.guilds.fetch(
            GUILD_ID
          );
      }

      if (guild) {
        return guild;
      }
    } catch (error) {
      console.warn(
        `Guild fetch failed (${attempt}/5):`,
        error
      );

      if (attempt < 5) {
        await sleep(1500);
      }
    }
  }

  throw new AuthError(
    "AUTH-008",
    "Failed to fetch Discord guild"
  );
}

/* =========================================================
   DISCORD MEMBER
========================================================= */

async function fetchMember(
  guild,
  userId
) {
  for (
    let attempt = 1;
    attempt <= 5;
    attempt++
  ) {
    try {
      let member =
        guild.members.cache.get(
          userId
        );

      if (!member) {
        member =
          await guild.members.fetch(
            userId
          );
      }

      if (member) {
        return member;
      }
    } catch (error) {
      console.warn(
        `Member fetch failed (${attempt}/5):`,
        error
      );

      if (attempt < 5) {
        await sleep(1500);
      }
    }
  }

  throw new AuthError(
    "AUTH-009",
    "Failed to fetch Discord member"
  );
}

/* =========================================================
   MOD LOG
========================================================= */

async function sendModLog(
  guild,
  content
) {
  try {
    if (
      !guild ||
      !MOD_LOG_CHANNEL
    ) {
      return;
    }

    let channel =
      guild.channels.cache.get(
        MOD_LOG_CHANNEL
      );

    if (!channel) {
      channel =
        await guild.channels
          .fetch(
            MOD_LOG_CHANNEL
          )
          .catch(() => null);
    }

    if (
      !channel ||
      typeof channel.isTextBased !==
        "function" ||
      !channel.isTextBased()
    ) {
      return;
    }

    await channel.send(content);
  } catch (error) {
    console.error(
      "MOD LOG ERROR:",
      error
    );
  }
}

/* =========================================================
   CALLBACK
========================================================= */

export async function handleOAuthCallback(
  req,
  res,
  client
) {
  let ipHash = null;
  let uaHash = null;

  let user = null;
  let guild = null;

  try {
    /* =====================
       REQUEST
    ===================== */

    const code =
      req.query?.code;

    const ip =
      extractIP(req);

    const userAgent =
      req.headers?.["user-agent"] ||
      "unknown";

    if (!code || !ip) {
      throw new AuthError(
        "AUTH-001",
        "Authentication information is missing"
      );
    }

    ipHash = sha256(ip);
    uaHash = sha256(userAgent);

    /* =====================
       RATE LIMIT
    ===================== */

    if (
      !checkRateLimit(
        `${ipHash}:${uaHash}`
      )
    ) {
      await insertAuthLog(
        null,
        ipHash,
        uaHash,
        "rate_limit",
        "too many authentication attempts"
      );

      throw new AuthError(
        "AUTH-002",
        "Too many authentication attempts"
      );
    }

    /* =====================
       TOKEN
    ===================== */

    const token =
      await exchangeDiscordCode(
        code
      );

    /* =====================
       USER
    ===================== */

    user =
      await getDiscordUser(
        token.access_token
      );

    /* =====================
       VPN
    ===================== */

    let vpnResult;

    try {
      vpnResult =
        await checkVPN(ip);
    } catch (error) {
      /*
       * VPN API自体の障害
       */
      if (
        error instanceof AuthError &&
        error.code === "AUTH-013"
      ) {
        await insertAuthLog(
          user.id,
          ipHash,
          uaHash,
          "vpn_api_error",
          error.message
        );

        throw error;
      }

      throw error;
    }

    if (vpnResult.blocked) {
      await insertAuthLog(
        user.id,
        ipHash,
        uaHash,
        "vpn_detected",
        vpnResult.reason
      );

      await addWarn(
        user.id,
        1
      );

      throw new AuthError(
        "AUTH-003",
        "VPN / Proxy / Tor / Relay detected"
      );
    }

    /* =====================
       SUB ACCOUNT
    ===================== */

    const owner =
      await findUserByIPandUA(
        ipHash,
        uaHash
      );

    if (
      owner &&
      owner !== user.id
    ) {
      await insertAuthLog(
        user.id,
        ipHash,
        uaHash,
        "sub_account",
        `owner:${owner}`
      );

      await addWarn(
        user.id,
        2
      );

      throw new AuthError(
        "AUTH-004",
        "Possible sub account detected"
      );
    }

    /* =====================
       DISCORD
    ===================== */

    guild =
      await fetchGuild(client);

    const member =
      await fetchMember(
        guild,
        user.id
      );

    /* =====================
       ROLE
    ===================== */

    if (!ROLE_ID) {
      throw new AuthError(
        "AUTH-014",
        "ROLE_ID is not configured"
      );
    }

    const hasRole =
      member.roles?.cache?.has(
        ROLE_ID
      );

    if (!hasRole) {
      try {
        await member.roles.add(
          ROLE_ID,
          "OAuth authentication completed"
        );
      } catch (error) {
        console.error(
          "ROLE ADD ERROR:",
          error
        );

        throw new AuthError(
          "AUTH-010",
          "Failed to add Discord role",
          error
        );
      }
    }

    /* =====================
       DB
    ===================== */

    try {
      await upsertUserAuth(
        user.id,
        user.username,
        ipHash,
        uaHash
      );

      await insertAuthLog(
        user.id,
        ipHash,
        uaHash,
        "auth_success",
        "ok"
      );
    } catch (error) {
      console.error(
        "DATABASE ERROR:",
        error
      );

      throw new AuthError(
        "AUTH-011",
        "Database operation failed",
        error
      );
    }

    /* =====================
       MOD LOG
    ===================== */

    await sendModLog(
      guild,
`🛡️ AUTH SUCCESS
user: ${user.username}
id: ${user.id}
ip: ${ipHash.slice(0, 8)}
ua: ${uaHash.slice(0, 8)}`
    );

    /* =====================
       SUCCESS
    ===================== */

    if (!res.headersSent) {
      res
        .status(200)
        .send(`
          <!DOCTYPE html>
          <html lang="ja">
          <head>
            <meta charset="UTF-8">
            <meta
              name="viewport"
              content="width=device-width,initial-scale=1"
            >
            <title>認証完了</title>
          </head>

          <body>
            <h1>認証完了 🎉</h1>

            <p>
              ${escapeHTML(
                user.username
              )}
            </p>
          </body>
          </html>
        `);
    }

  } catch (error) {
    /* =====================================================
       ERROR HANDLING
    ===================================================== */

    const authError =
      toAuthError(error);

    /*
     * 詳細はサーバーログだけ
     */
    console.error(
      `[${authError.code}]`,
      authError.message,
      authError.cause || ""
    );

    /* =====================
       AUTH LOG
    ===================== */

    try {
      await insertAuthLog(
        user?.id ?? null,
        ipHash,
        uaHash,
        "auth_failed",
        `${authError.code}: ${authError.message}`
      );
    } catch (logError) {
      console.error(
        "AUTH LOG ERROR:",
        logError
      );
    }

    /* =====================
       MOD LOG
    ===================== */

    try {
      if (!guild && client) {
        guild =
          client.guilds?.cache?.get(
            GUILD_ID
          ) ||
          await client.guilds
            ?.fetch(GUILD_ID)
            .catch(() => null);
      }

      await sendModLog(
        guild,
`🚫 AUTH FAILED
code: ${authError.code}
reason: ${authError.message}
user: ${user?.username ?? "unknown"}
id: ${user?.id ?? "unknown"}
ip: ${ipHash?.slice(0, 8) ?? "unknown"}
ua: ${uaHash?.slice(0, 8) ?? "unknown"}`
      );
    } catch (logError) {
      console.error(
        "FAILED MOD LOG ERROR:",
        logError
      );
    }

    /* =====================
       USER RESPONSE
    ===================== */

    /*
     * ここが重要。
     *
     * ユーザーにはreasonを絶対に出さず、
     * エラーコードだけ表示する。
     */

    if (!res.headersSent) {
      res
        .status(403)
        .send(`
          <!DOCTYPE html>
          <html lang="ja">
          <head>
            <meta charset="UTF-8">
            <meta
              name="viewport"
              content="width=device-width,initial-scale=1"
            >
            <title>認証失敗</title>

            <style>
              body {
                margin: 0;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #0a0a0c;
                color: #fff;
                font-family:
                  system-ui,
                  -apple-system,
                  BlinkMacSystemFont,
                  sans-serif;
              }

              .error {
                text-align: center;
              }

              h1 {
                margin-bottom: 12px;
              }

              .code {
                font-family: monospace;
                font-size: 18px;
                opacity: .8;
              }

              .description {
                margin-top: 20px;
                opacity: .55;
                font-size: 14px;
              }
            </style>
          </head>

          <body>
            <div class="error">
              <h1>認証失敗</h1>

              <div class="code">
                ${escapeHTML(
                  authError.code
                )}
              </div>

              <div class="description">
                このエラーコードを管理者に伝えてください。
              </div>
            </div>
          </body>
          </html>
        `);
    }
  }
}

const rest = new REST({ version: "10" }).setToken(DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log("スラッシュコマンド登録中...");

    const body = commands.map(cmd =>
      typeof cmd.toJSON === "function" ? cmd.toJSON() : cmd
    );
    console.log(body);
    
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID,DISCORD_GUILD_ID),
      { body }
    );

    console.log("✅ コマンド登録完了");
  } catch (err) {
    console.error("❌ コマンド登録失敗:", err);
    commands.forEach(cmd => {
      console.error('壊れてるコマンド:', cmd.name, err);
    });

  }
});

// pinned table check note: with Supabase you'd usually create tables via migration
async function ensurePinnedTableExists() {
  // try to SELECT to detect table existence
  try {
    const { error } = await supabase.from('pinned_messages').select('channel_id').limit(1);
    if (error) {
      console.warn('pinned_messages table check failed. Make sure migration created the table.', error);
    }
  } catch (e) {
    console.warn('pinned_messages table check unexpected error', e);
  }
}
ensurePinnedTableExists();

// interaction handler
client.on('interactionCreate', async interaction => {
  let sub = null;
  
  if(interaction.isChatInputCommand()) {
    sub = interaction.options.getSubcommand(false);
  }
  
  await handleInteractionCreate(interaction, {
    client,
    fetch,
    chartJSNodeCanvas,
    os,
    si,
    sub,
    AttachmentBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    PermissionsBitField,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    path,
    fileURLToPath,
    ytdl,
    playdl,
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
   // VoiceConnectionStatus,
    entersState,
    StreamType,
    queues,
    supabase,
    upsertPinned,
    getPinnedByChannel,
    deletePinned,
    parseDuration,
    parseDurationDetailed,
    scheduleTimeoutContinuation,
    clearTimeoutContinuation,
    logModerationAction,
    startRecord,
    stopRecord,
    createUserAccount,
    deleteUserAccount,
    transferUserAccount,
    fetchUserAccount,
    calculateUserLevel,
    ALLOWED_CHANNEL_IDS,
    CHANNEL_COOLDOWN_MS,
    channelCooldowns,
    forumThreadsData,
    GatyaLoad,
    shiikurole
  });
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const oldTs = oldMember.communicationDisabledUntilTimestamp ?? 0;
  const newTs = newMember.communicationDisabledUntilTimestamp ?? 0;
  if (oldTs === newTs) return;

  const isTimeoutSet = newTs > Date.now();
  const entry = await fetchLatestAuditLog(newMember.guild, AuditLogEvent.MemberUpdate);

  await logModerationAction({
    guild: newMember.guild,
    action: isTimeoutSet ? "TIMEOUT" : "UNTIMEOUT",
    target: newMember.user,
    moderator: entry?.executor ?? null,
    reason: entry?.reason ?? null,
    durationMs: isTimeoutSet ? Math.max(newTs - Date.now(), 0) : null,
    targetMember: newMember
  });
});

client.on("guildBanAdd", async ban => {
  const entry = await fetchLatestAuditLog(ban.guild, AuditLogEvent.MemberBanAdd);

  await logModerationAction({
    guild: ban.guild,
    action: "BAN",
    target: ban.user,
    moderator: entry?.executor ?? null,
    reason: entry?.reason ?? null
  });
});

client.on("guildMemberRemove", async member => {
  const entry = await fetchLatestAuditLog(member.guild, AuditLogEvent.MemberKick);
  if (!entry || entry.target?.id !== member.id) return;
  if (Date.now() - entry.createdTimestamp > 15000) return;

  await logModerationAction({
    guild: member.guild,
    action: "KICK",
    target: member.user,
    moderator: entry.executor ?? null,
    reason: entry.reason ?? null,
    targetMember: member
  });
});
      
processDueTimeoutContinuations().catch(err => console.error("timeout continuation init failed:", err));
setInterval(() => {
  processDueTimeoutContinuations().catch(err => console.error("timeout continuation interval failed:", err));
}, 30_000);

/* 
  ガチャのデータ読み込み
*/
export const forumThreadsData = []; // ガチャ一覧をメモリに保持
const GATYA_CHANNEL_ID = '1441416133302419506';

export async function GatyaLoad() {
  forumThreadsData.length = 0;

  let channel;
  try {
    channel = await client.channels.fetch(GATYA_CHANNEL_ID);
  } catch (e) {
    console.error('チャンネル取得に失敗:', e);
    return;
  }

  if (!channel || channel.type !== ChannelType.GuildForum) {
    console.error('指定のチャンネルはフォーラムではありません');
    return;
  }

  // アクティブスレッド
  try {
    const activeThreads = await channel.threads.fetchActive();
    await processThreads(activeThreads.threads);
  } catch (e) {
    console.error('アクティブスレッドの取得に失敗:', e);
  }

  // アーカイブ済みスレッド
  try {
    const archivedThreads = await channel.threads.fetchArchived({ type: 'public' });
    await processThreads(archivedThreads.threads);
  } catch (e) {
    console.error('アーカイブスレッドの取得に失敗:', e);
  }

  console.log(`GatyaLoad: ${forumThreadsData.length} スレッド読み込み完了`);
}

function extractProbability(text) {
  if (typeof text !== 'string') return { probability: "", text: "" };
  const match = text.match(/\[(\d+)]$/);
  if (match) {
    return { probability: match[1], text: text.slice(0, match.index).trim() };
  }
  return { probability: "", text };
}

async function processThreads(threads) {
  for (const [, thread] of threads) {
    const threadData = {
      id: thread.id,
      title: thread.name,
      replyChannel: thread.topic?.match(/\d+/)?.[0] ?? null,
      messages: []
    };

    let lastId;
    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      let messages;
      try {
        messages = await thread.messages.fetch(options);
      } catch (e) {
        console.error(`スレッド ${thread.id} のメッセージ取得に失敗:`, e);
        break; // このスレッドは諦める
      }

      if (messages.size === 0) break;

      const sorted = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      sorted.forEach(msg => {
        try {
          const { probability, text } = extractProbability(msg.content);
          threadData.messages.push({ probability, text });
        } catch (e) {
          console.error(`スレッド ${thread.id} のメッセージ解析に失敗:`, e);
        }
      });

      lastId = messages.last().id;
    }

    forumThreadsData.push(threadData);
  }
}


// playNext
function playNext(guildId) {
  const guildQueue = queues.get(guildId);
  if (!guildQueue || guildQueue.songs.length === 0) {
    if (guildQueue?.connection) guildQueue.connection.destroy();
    queues.delete(guildId);
    return;
  }

  const song = guildQueue.songs[0];
  if (!song || !song.stream) {
    console.error("ストリームが生成されてない or song missing");
    guildQueue.songs.shift();
    return playNext(guildId);
  }

  const resource = createAudioResource(song.stream);
  guildQueue.player.play(resource);
  guildQueue.connection.subscribe(guildQueue.player);

  guildQueue.player.removeAllListeners(AudioPlayerStatus.Idle);
  guildQueue.player.on(AudioPlayerStatus.Idle, () => {
    guildQueue.songs.shift();
    playNext(guildId);
  });

  guildQueue.player.on('error', (err) => {
    console.error('Audio player error', err);
    // drop current and continue
    try {
      guildQueue.songs.shift();
      playNext(guildId);
    } catch (e) { console.error(e); }
  });
}

const voiceTimes = new Map();

// VC 状態を保持
export const voiceStates = new Map(); // guildId → Map(userId → channelId)

client.on("voiceStateUpdate", async (oldState, newState) => {
  const guildId = newState.guild.id;

  if (!voiceStates.has(guildId)) {
    voiceStates.set(guildId, new Map());
  }

  const guildMap = voiceStates.get(guildId);

  // 退出
  if (!newState.channelId) {
    guildMap.delete(newState.id);
    return;
  }

  // 入室 or 移動
  guildMap.set(newState.id, newState.channelId);
  
    const userId = newState.member?.id;
    if (!userId) return;
    if (newState.member.user.bot) return;

    const userData = await fetchUserAccount(userId);
    if (!userData) return;

    const now = Date.now();
    const lastTime = userData.vc_last_xp ? new Date(userData.vc_last_xp).getTime() : 0;

    const cooldown = 10 * 60 * 1000; // 10分

    // VCに入った場合のみ
    const joinedVoice = !oldState.channelId && newState.channelId;
    if (!joinedVoice) return;

    // クールタイム中 → XPなし
    if (now - lastTime < cooldown) return;

    // XP付与
    await addUserExperience(userId, "voice");

    // 最終XP時間更新
    await supabase
        .from("users")
        .update({ vc_last_xp: new Date().toISOString() })
        .eq("userid", userId);
  });

// ファイルの上部（rateLimitの定義の近く）に追加
const chatHistory = new Map();

async function handleAI(message) {
  const now = Date.now();
  const last = rateLimit.get(message.author.id) ?? 0;

  if (now - last < COOLDOWN) {
    const remain = ((COOLDOWN - (now - last)) / 1000).toFixed(1);
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("⏱ クールダウン")
          .setDescription(`あと **${remain}秒**`)
          .setColor(0xff6666)
      ]
    });
  }

  rateLimit.set(message.author.id, now);

  try {
    const thinking = await message.reply({
      embeds: [new EmbedBuilder().setDescription("Thinking…").setColor(0xaaaaaa)]
    });

    // ユーザーごとの過去の履歴を取得（なければ空配列を作成）
    let userHistory = chatHistory.get(message.author.id) ?? [];

    // AIに送るメッセージの組み立て（システムプロンプト＋過去の履歴＋今の発言）
    const messages = [
      {
        role: "system",
        content: "あなたはユーザーの長年の「親友（幼馴染や親友のような関係）」です。以下のルールを厳格に守って日本語で会話してください。\n" +
                 "1. 敬語や丁寧語（です・ます等）は絶対に禁止。完全なタメ口で話すこと。\n" +
                 "2. 「～じゃん」「～だよね」「～だろ」「～じゃん？」など、自然で親しみやすい口調にする。\n" +
                 "3. チャラい言葉（「ウェーイ」など）や、軽薄な喋り方は絶対にしないこと。落ち着きつつもフランクな距離感を保つ。\n" +
                 "4. 知らないことは知ったかぶりせず、「それは知らないわ」「聞いたことないな」と素直に言うこと。\n" +
                 "5. 相手を突き放さず、親身になって相談に乗ったり、冗談を言い合ったりする温かい距離感で接すること。",
      },
      ...userHistory, // 過去の会話履歴を展開
      {
        role: "user",
        content: message.content,
      }
    ];

    // ai呼び出し
    const response = await inference.chatCompletion({
      model: "google/gemma-3-12b-it",
      messages: messages,
      max_tokens: 1028
    });

    const text = response.choices?.message?.content ?? "……（返答が空でした）";

    // 今回の会話を履歴に追加
    userHistory.push({ role: "user", content: message.content });
    userHistory.push({ role: "assistant", content: text });

    // 履歴が長くなりすぎるとエラーになるので、最新の2往復（4メッセージ）に制限
    if (userHistory.length > 4) {
      userHistory = userHistory.slice(-10);
    }
    chatHistory.set(message.author.id, userHistory);

    await thinking.edit({
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name: message.author.username,
            iconURL: message.author.displayAvatarURL()
          })
          .setDescription(text.slice(0, 4000))
          .setColor(0x55ff99)
          .setFooter({ text: "powered by Hugging Face (Gemma3 12B)" })
      ]
    });

  } catch (e) {
    rateLimit.delete(message.author.id);
    console.error("[DEBUG] SDK Error Details:", e);
    
    let failMessage = `⚠️ AIエラー（システムエラー） ('${e.message}")`;
    if (e.message?.includes("403")) {
      failMessage = "⚠️ トークンエラー (403): 環境変数「HF_TOKEN」を確認してください。";
    }
    message.reply(failMessage);
  }
}

 async function handlePinned(message){
  try {
    if (message.partial) await message.fetch().catch(() => null);
    if (!message.channel) return;

    const pinData = await getPinnedByChannel(message.channel.id);
    if (!pinData) return;

    const oldMsg = await message.channel.messages.fetch(pinData.message_id).catch(() => null);
    if (oldMsg) await oldMsg.delete().catch(() => {});

    const embed = new EmbedBuilder()
      .setDescription(pinData.content)
      .setColor(0x00AE86)
      .setFooter({ text: `📌 投稿者: ${pinData.author_name || '不明'}` })
      .setTimestamp();

  const sent = await message.channel.send({ embeds: [embed] })
   .catch(err => {
    console.error("PIN send failed:", err);
    return null;
  });

if (!sent) return;

    await upsertPinned(message.channel.id, sent.id);
  } catch (err) {
    console.error('固定メッセージ更新エラー:', err);
  }
 }

async function runGacha(message, set) {
  try {
    // 1. アイテム取得
    const { data: items, error: itemError } = await supabase
      .from('gacha_items')
      .select('*')
      .eq('set_id', set.id);

    if (itemError || !items || items.length === 0) {
      console.error('No items found or error:', itemError);
      return;
    }

    // 2. レアリティ抽選 (安全なJSONパース)
    let probabilities = set.probabilities;
    if (typeof probabilities === 'string') {
      try {
        probabilities = JSON.parse(probabilities);
      } catch (e) {
        console.error("Failed to parse probabilities JSON:", e);
        return;
      }
    }

    // 確率の合計値を計算して重み付け抽選
    const totalProbability = Object.values(probabilities).reduce((sum, val) => sum + Number(val), 0);
    let rand = Math.random() * totalProbability;
    let selectedRarity = null;

    for (const [rarity, percent] of Object.entries(probabilities)) {
      rand -= Number(percent);
      if (rand <= 0) {
        selectedRarity = rarity;
        break;
      }
    }

    if (!selectedRarity) {
      selectedRarity = Object.keys(probabilities)[0];
    }

    // 3. アイテム抽選 (配列を作らない重み付け抽選)
    const candidates = items.filter(i => i.rarity === selectedRarity);
    if (candidates.length === 0) {
      console.error(`No items found for rarity: ${selectedRarity}`);
      return;
    }

    const totalWeight = candidates.reduce((sum, item) => sum + (parseInt(item.amount) || 1), 0);
    let itemRand = Math.random() * totalWeight;
    let hit = candidates[0];

    for (const item of candidates) {
      itemRand -= (parseInt(item.amount) || 1);
      if (itemRand <= 0) {
        hit = item;
        break;
      }
    }

    console.log(`--- ガチャ実行ログ ---`);
    console.log(`サーバー名: ${message.guild.name} (${message.guild.id})`);
    console.log(`チャンネル名: ${message.channel.name} (${message.channel.id})`);
    console.log(`ユーザー: ${message.author.tag} (${message.author.id})`);
    console.log(`入力文言: "${message.content}"`);
    console.log(`ヒットした設定名: ${set.name}`);
    console.log(`----------------------`);

    // 4. ログ保存
    const { error: logError } = await supabase
      .from('gacha_logs')
      .insert({
        guild_id: message.guild.id,
        set_id: set.id,
        user_id: message.author.id,
        display_id: hit.display_id,
        rarity: hit.rarity
      });

    if (logError) console.error("Log insert failed:", logError);

    const displayName = message.author.username || "不明";
    let finalDescription = hit.description || "";
    if (finalDescription.includes("[userName]")) {
      finalDescription = finalDescription.replaceAll("[userName]", displayName);
    }
    const formattedDescription = finalDescription.replace(/\\n/g, '\n');

    const imageRegex = /(https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s]*)?)/i;
    const match = formattedDescription.match(imageRegex);
    const imageUrl = match ? match[0] : null;

    // 5. Embed 送信
    const embed = new EmbedBuilder()
      .setTitle(`🎰 ${set.name}`)
      .setDescription(`**${hit.name}**\n${formattedDescription}`)
      .addFields({ name: 'レアリティ', value: hit.rarity, inline: true })
      .setColor(0xF1C40F);

    if (imageUrl) {
      embed.setImage(imageUrl);
    }
    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
  } catch (err) {
    console.error("Critical error in runGacha:", err);
  }
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  /* =====================
      DM COMMANDS
  ===================== */
  if (!message.guild) {
    const cmd = message.content.trim();
    
    const dmCommands = {
      "/unselfto": { guildId: DISCORD_GUILD_ID, modLogId: DISCORD_MOD_LOG_CHANNEL_ID, checkPerms: false },
      "s.toleft":  { guildId: DISCORD_GUILD_ID, modLogId: DISCORD_MOD_LOG_CHANNEL_ID, checkPerms: true },
      "h.toleft":  { guildId: "1400830654949753023", modLogId: "1400885372480913458", checkPerms: true }
    };

    const config = dmCommands[cmd];
    if (!config) return;

    try {
      const guild = await client.guilds.fetch(config.guildId);
      const member = await guild.members.fetch(message.author.id).catch(() => null);

      if (!member) {
        return await message.reply("対象のサーバーに所属していません。");
      }

      if (config.checkPerms && !member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return await message.reply("この操作を実行する権限がありません。");
      }

      if (!member.communicationDisabledUntilTimestamp || member.communicationDisabledUntilTimestamp <= Date.now()) {
        return await message.reply("現在タイムアウトされていません。");
      }

      await member.timeout(null, `DM command: ${cmd}`);
      
      if (cmd === "/unselfto") {
        await deleteTimeoutContinuation(guild.id, message.author.id).catch(() => {});
      }

      await message.reply(`✅ タイムアウトを解除しました。 (${cmd})`);

      const modLog = await guild.channels.fetch(config.modLogId).catch(() => null);
      if (modLog?.isTextBased()) {
        await modLog.send(
          `🔓 Timeout Released\nuser: ${message.author.tag} (${message.author.id})\nmethod: DM command ${cmd}`
        );
      }
    } catch (err) {
      console.error(`DM command ${cmd} failed:`, err);
      await message.reply("処理中にエラーが発生しました。").catch(() => {});
    }
    return;
  }

  /* =====================
      GUILD MESSAGES
  ===================== */
  
  // ガチャ処理
  try {
    const { data: sets, error: setsError } = await supabase
      .from('gacha_sets')
      .select('*')
      .eq('guild_id', message.guild.id)
      .eq('enabled', true);

    if (setsError) {
      console.error("Fetch gacha_sets error:", setsError);
    } else if (sets?.length) {
      const matchedSet = sets.find(s => s.channel_id === message.channel.id && s.trigger_word === message.content.trim());
      if (matchedSet) {
        await runGacha(message, matchedSet);
        return;
      }
    }
  } catch (err) {
    console.error("Gacha check failed:", err);
  }

  // AI チャンネル処理
  if (message.channel.id === AI_CHANNEL_ID) {
    return handleAI(message);
  }

  // その他サイドエフェクト
  await handlePinned(message).catch(console.error);
  await addUserExperience(message.author.id, "text").catch(console.error);
});

// 📌 JST 5:00 の Cron ジョブ（お題送信）
cron.schedule(
  "0 0 5 * * *", // 秒まで指定して明示的に
  async () => {
    try {
      console.log("📢 Sending daily odai…");

      // 1. 未使用のお題を取得
      let { data: unused, error: fetchError } = await supabase
        .from("odai")
        .select("*")
        .eq("used", false);

      if (fetchError) throw fetchError;

      // 2. 未使用がなければリセット
      if (!unused || unused.length === 0) {
        console.log("🔄 Resetting all odai to unused…");
        const { error: resetError } = await supabase
          .from("odai")
          .update({ used: false })
          .gt("id", 0);
        
        if (resetError) throw resetError;

        const { data: allOdai, error: refetchError } = await supabase.from("odai").select("*");
        if (refetchError) throw refetchError;
        unused = allOdai ?? [];
      }

      // 3. ランダムに選択
      const pick = unused[Math.floor(Math.random() * unused.length)];
      if (!pick) return console.log("⚠️ No odai found.");

      // 4. 送信
      const channel = await client.channels.fetch(DISCORD_CHAT_CHANNEL_ID);
      if (channel) {
        await channel.send({
          embeds: [
            {
              title: "今日のお題",
              description: pick.text,
              color: 0x00bfff,
              footer: { text: `ID: ${pick.id} | 残り ${unused.length - 1} 件` },
              timestamp: new Date().toISOString(),
            },
          ],
        });
        console.log("✨ Sent:", pick.text);
      }

      // 5. 使用済みに更新
      await supabase.from("odai").update({ used: true }).eq("id", pick.id);

    } catch (err) {
      console.error("❌ Cron error:", err);
    }
  },
  { timezone: "Asia/Tokyo" }
);

// ready
client.once('ready', async () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  const ping = Math.round(client.ws.ping);

  client.user.setPresence({
    activities: [{ name: `Ping: ${ping}ms`, type: 0 }],
     status: 'online'
  });

setInterval(async () => {
  try {
    const now = new Date();

    // 1. settings の取得（nullガードを追加）
    const { data: settings, error: sError } = await supabase.from("bump_settings").select("*");
    if (sError || !settings) return; // 取得失敗時は次の10秒後にリトライ

    for (const s of settings) {
      // 2. logs の取得（nullガードを追加）
      const { data: logs, error: lError } = await supabase
        .from("bump_logs")
        .select("*")
        .eq("bot_id", s.bot_id);

      if (lError || !logs) continue; // このbotのログ取得に失敗したら次へ

      for (const log of logs) {
        const detected = new Date(log.detected_at);
        const diff = (now - detected) / 1000 / 60;

        if (diff >= s.wait_minutes) {
          const channel = client.channels.cache.get(log.channel_id);
          if (channel) {
            // エラーでループを止めないよう、送信処理も try-catch 推奨
            try {
              await channel.send({
                content: `<@&1209371709451272215> 時間だよ！⏰\n</up:${log.command_id}> を実行してね！`,
                embeds: [{
                  title: "bump リマインド",
                  description: `検出から${s.wait_minutes}分経過したよ！`,
                  timestamp: new Date().toISOString()
                }]
              });
            } catch (err) {
              console.error("メッセージ送信失敗:", err);
            }
          }

          // 3. 削除処理
          await supabase.from("bump_logs").delete().eq("id", log.id);
        }
      }
    }
  } catch (globalError) {
    console.error("Interval内エラー:", globalError);
  }
}, 10_000);

  setInterval(() => {
    const pingNow = Math.round(client.ws.ping);
    client.user.setPresence({
      activities: [{ name: `Ping: ${pingNow}ms`, type: 0 }],
      status: 'online'
    });
  }, 10000);
});

client.login(DISCORD_BOT_TOKEN)
