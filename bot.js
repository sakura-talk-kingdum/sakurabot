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
  Partials
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
  shiikurole
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

function isPrimaryShard() {
  if (globalThis.__SAKURA_SHARD_ROLE__) {
    return globalThis.__SAKURA_SHARD_ROLE__.isPrimary;
  }

  return !client.shard || client.shard.ids[0] === 0;
}

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
        console.error("timeout continuation process failed:", err);
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

/* =====================
   UTIL
===================== */

function sha256(v) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

function normalizeIP(ip) {
  if (!ip) return null;
  if (ip.startsWith("::ffff:")) return ip.replace("::ffff:", "");
  return ip;
}

function extractIP(req) {

  const fwd = req.headers["x-forwarded-for"];

  if (fwd) {
    return normalizeIP(fwd.split(",")[0].trim());
  }

  return normalizeIP(req.socket.remoteAddress);
}

/* =====================
   VPN CHECK
===================== */

async function checkVPN(ip) {

  try {

    const res = await fetch(
      `https://vpnapi.io/api/${ip}?key=${process.env.VPN_API_KEY}`
    );

    if (!res.ok) return true;

    const data = await res.json();

    const s = data.security;

    return Boolean(
      s?.vpn ||
      s?.proxy ||
      s?.tor ||
      s?.relay
    );

  } catch {
    return true;
  }
}

/* =====================
   CALLBACK
===================== */

export async function handleOAuthCallback(req, res, client) {

  let ipHash = null;
  let uaHash = null;

  try {

    const code = req.query.code;

    const ip = extractIP(req);

    const ua = req.headers["user-agent"] || "unknown";

    if (!code || !ip) {
      throw new Error("認証情報が不足しています");
    }

    ipHash = sha256(ip);
    uaHash = sha256(ua);

    if (!checkRateLimit(`${ipHash}:${uaHash}`)) {

      await insertAuthLog(null, ipHash, uaHash, "rate_limit", "too many");

      throw new Error("認証試行が多すぎます");
    }

    /* TOKEN */

    const basic = Buffer
      .from(
        `${process.env.DISCORD_CLIENT_ID}:${process.env.DISCORD_CLIENT_SECRET}`
      )
      .toString("base64");

    const tokenRes = await fetch(
      "https://discord.com/api/v10/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basic}`
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: process.env.REDIRECT_URI
        })
      }
    );

    const token = await tokenRes.json();

    if (!token.access_token) {
      throw new Error("Discord token取得失敗");
    }

    /* USER */

    const userRes = await fetch(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`
        }
      }
    );

    const user = await userRes.json();

    if (!user?.id) {
      throw new Error("ユーザー取得失敗");
    }

    /* VPN */

    if (await checkVPN(ip)) {

      await insertAuthLog(
        user.id,
        ipHash,
        uaHash,
        "vpn_detected",
        "vpn or proxy"
      );

      await addWarn(user.id, 1);

      throw new Error("VPN / Proxy が検知されました");
    }

    /* SUB ACCOUNT */

    const owner = await findUserByIPandUA(ipHash, uaHash);

    if (owner && owner !== user.id) {

      await insertAuthLog(
        user.id,
        ipHash,
        uaHash,
        "sub_account",
        `owner:${owner}`
      );

      await addWarn(user.id, 2);

      throw new Error("サブアカウントの可能性があります");
    }

    /* DB */
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

    /* ROLE */
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(user.id);

    if (!member.roles.cache.has(process.env.ROLE_ID)) {
      await member.roles.add(process.env.ROLE_ID);
    }
    
    /* MOD LOG */

    const mod = await guild.channels.fetch(process.env.MOD_LOG_CHANNEL);

    if (mod?.isTextBased()) {
      mod.send(
`🛡 AUTH SUCCESS
user: ${user.username}
id: ${user.id}
ip: ${ipHash.slice(0,8)}
ua: ${uaHash.slice(0,8)}`
      );
    }
    res.send(`<h1>認証完了 🎉 ${user.username}</h1>`);
  } catch (e) {
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const mod = await guild.channels.fetch(process.env.MOD_LOG_CHANNEL);

      if (mod?.isTextBased()) {
        mod.send(
`🚫 AUTH FAILED
reason: ${e.message}
ip: ${ipHash?.slice(0,8) ?? "unknown"}`
        );
      }
    } catch {}
    res
      .status(403)
      .send(`<h1>認証失敗</h1><p>${e.message}</p>`);
  }
}

const rest = new REST({ version: "10" }).setToken(DISCORD_BOT_TOKEN);

(async () => {
  if (!isPrimaryShard()) return;

  try {
    console.log("スラッシュコマンド登録中...");

    const body = commands.map(cmd =>
      typeof cmd.toJSON === "function" ? cmd.toJSON() : cmd
    );
    console.log(body);
    
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID,"1400830654949753023"),
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
if (isPrimaryShard()) {
  ensurePinnedTableExists();
}

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
    VoiceConnectionStatus,
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
      
if (isPrimaryShard()) {
  processDueTimeoutContinuations().catch(err => console.error("timeout continuation init failed:", err));
  setInterval(() => {
    processDueTimeoutContinuations().catch(err => console.error("timeout continuation interval failed:", err));
  }, 30_000);
}

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

    const res = await fetch(
      "https://router.huggingface.co/hf-inference/models/google/flan-t5-small",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: message.content })
      }
    );

    const data = await res.json();
    const text = data?.[0]?.generated_text ?? "……";

    await thinking.edit({
      embeds: [
        new EmbedBuilder()
          .setAuthor({
            name: message.author.username,
            iconURL: message.author.displayAvatarURL()
          })
          .setDescription(text.slice(0, 4000))
          .setColor(0x55ff99)
          .setFooter({ text: "powered by Hugging Face" })
      ]
    });

  } catch (e) {
    rateLimit.delete(message.author.id);
    console.error(e);
    message.reply("⚠️ AIエラー");
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
  console.log('guild', message.guild.id)
  console.log('channel', message.channel.id)
  console.log('content', message.content)
  console.log('set', set.name)

  const { data: items, error } = await supabase
    .from('gacha_items')
    .select('*')
    .eq('set_id', set.id)

  if (error || !items || items.length === 0) return

  /* ===== レアリティ抽選（DBの確率を使う） ===== */
/* ===== レアリティ抽選 ===== */
const probabilities =
  typeof set.probabilities === 'string'
    ? JSON.parse(set.probabilities)
    : set.probabilities

let rand = Math.random() * 100
let acc = 0
let selectedRarity = null

for (const [rarity, percent] of Object.entries(probabilities)) {
  acc += percent
  if (rand <= acc) {
    selectedRarity = rarity
    break
  }
}

if (!selectedRarity) return

  /* ===== アイテム抽選（amountのみ） ===== */
  const candidates = items.filter(i => i.rarity === selectedRarity)
  if (candidates.length === 0) return

  let pool = []
  for (const i of candidates) {
    for (let n = 0; n < i.amount; n++) {
      pool.push(i)
    }
  }

  const hit = pool[Math.floor(Math.random() * pool.length)]

  /* ===== ログ保存（引いた記録を書き込む） ===== */
  await supabase
    .from('gacha_logs')
    .insert({
    guild_id: 'guild',           
    set_id: set.id,              
    user_id: message.author.id,  
    display_id: hit.display_id,  
    rarity: hit.rarity           
  })


  /* ===== Embed ===== */
  const embed = new EmbedBuilder()
    .setTitle(`🎰 ${set.name}`)
    .setDescription(`**${hit.name}**\n**${hit.description}**`)
    .addFields({ name: 'レアリティ', value: hit.rarity, inline: true })
    .setColor(0xF1C40F)

  await message.reply({ embeds: [embed] , allowedMentions: { repliedUser: false } })
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Shard 0 のみで実行する処理のフラグ
  const isShard0 = !client.shard || client.shard.ids.includes(0);

  /* =====================
      DM COMMANDS
  ===================== */
  if (!message.guild) {
    if (!isShard0) return; // 重複実行防止

    const cmd = message.content.trim();
    
    // コマンド判定用の設定オブジェクト
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

      // 権限チェックが必要なコマンドの場合
      if (config.checkPerms && !member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return await message.reply("この操作を実行する権限がありません。");
      }

      // タイムアウト中かチェック
      if (!member.communicationDisabledUntilTimestamp || member.communicationDisabledUntilTimestamp <= Date.now()) {
        return await message.reply("現在タイムアウトされていません。");
      }

      // 解除処理
      await member.timeout(null, `DM command: ${cmd}`);
      
      // データベース連携がある場合はここに追加 (例: deleteTimeoutContinuation)
      if (cmd === "/unselfto") {
        await deleteTimeoutContinuation(guild.id, message.author.id).catch(() => {});
      }

      await message.reply(`✅ タイムアウトを解除しました。 (${cmd})`);

      // ログ送信
      const modLog = await guild.channels.fetch(config.modLogId).catch(() => null);
      if (modLog?.isTextBased()) {
        await modLog.send(
`🔓 Timeout Released
user: ${message.author.tag} (${message.author.id})
method: DM command ${cmd}`
        );
      }
    } catch (err) {
      console.error(`DM command ${cmd} failed:`, err);
      await message.reply("処理中にエラーが発生しました。").catch(() => {});
    }
    return; // DMの場合はここで終了
  }

  /* =====================
      GUILD MESSAGES
  ===================== */
  
  // ガチャ処理
  try {
    const { data: sets } = await supabase
      .from('gacha_sets')
      .select('*')
      .eq('guild_id', message.guild.id) // 文字列 'guild' ではなく実際の ID
      .eq('enabled', true);

    if (sets?.length) {
      const matchedSet = sets.find(s => s.channel_id === message.channel.id && s.trigger_word === message.content.trim());
      if (matchedSet) {
        await runGacha(message, matchedSet);
        return; // ガチャが反応した場合は他の処理をスキップ
      }
    }
  } catch (err) {
    console.error("Gacha check failed:", err);
  }

  // AI チャンネル処理
  if (message.channel.id === AI_CHANNEL_ID) {
    return handleAI(message);
  }

  // その他サイドエフェクト (Shard 0 のみ)
  if (isShard0) {
    await handlePinned(message).catch(console.error);
    await addUserExperience(message.author.id, "text").catch(console.error);
  }
});

// 📌 JST 5:00 の Cron ジョブ（お題送信）
cron.schedule(
  "0 0 5 * * *", // 秒まで指定して明示的に
  async () => {
    // シャーディング対応：最初のシャード以外は実行しない
    const isShard0cron = !client.shard || client.shard.ids.includes(0);
    if (!isShard0cron) return;

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

        const { data: allOdai } = await supabase.from("odai").select("*");
        unused = allOdai;
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
  const shardInfo = client.shard ? `${client.shard.ids[0] + 1}/${client.shard.count}` : '1/1';
  const ping = Math.round(client.ws.ping);

  client.user.setPresence({
    activities: [{ name: `Shard ${shardInfo} | Ping: ${ping}ms`, type: 0 }],
     status: 'online'
  });

if (isPrimaryShard()) {
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
}

  setInterval(() => {
    const pingNow = Math.round(client.ws.ping);
    client.user.setPresence({
      activities: [{ name: `Shard ${shardInfo} | Ping: ${pingNow}ms`, type: 0 }],
      status: 'online'
    });
  }, 10000);
});

client.login(DISCORD_BOT_TOKEN)
