import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from "cookie-parser";
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from'path';
dotenv.config();
import { supabase } from "./db.js";
import { shardState } from "./index.js";
import { handleOAuthCallback, client, voiceStates } from './bot.js';
import cors from 'cors';
import csurf from 'csurf';
import rateLimit from 'express-rate-limit';

const app = express();
const oauthCallbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 callback requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cookieParser());
app.set('trust proxy', 1); 
const csrfProtection = csurf({ cookie: true });

app.post('/process', csrfProtection, (req, res) => {
  res.send('data is being processed');
});

const PORT = process.env.PORT || 3000;

/* =====================
  基本設定
===================== */
const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET
} = process.env

const DISCORD_REDIRECT_URI = 'https://bot.sakurahp.f5.si/gachas/auth/callback';

// ガチャ管理者（Discord User ID）
const GACHA_ADMINS = [
  '1208358513580052500',
  '1099098129338466385',
  '780319649857929237',
  '1343054861243256897',
  '1089222363238912152'
]

// in-memory session（本気ならRedisに差し替え）
const sessions = new Map()

/* =====================
  レアリティ定義
===================== */
const RARITY_WEIGHT = {
  common: 100,
  uncommon: 40,
  rare: 15,
  epic: 5,
  legend: 1,
  superlegend: 0.2
}

/* =====================
  util
===================== */
function newSession(uid, username) {
  const sid = crypto.randomUUID()
  sessions.set(sid, {
    uid,
    username,
    created: Date.now()
  })
  return sid
}

/* =====================
  middleware
===================== */
function requireAuth(req, res, next) {
  const sid = req.cookies.sid
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  req.user = sessions.get(sid)
  next()
}

function requireAdmin(req, res, next) {
  if (!GACHA_ADMINS.includes(req.user.uid)) {
    return res.status(403).json({ error: 'forbidden' })
  }
  next()
}

const DISCORD_API = "https://discord.com/api/v10";

// ===== OAuth2 URL =====
function adminOAuthURL() {
  return `https://discord.com/oauth2/authorize?` +
    new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: 'https://bot.sakurahp.f5.si/admins/callback',
      response_type: "code",
      scope: "identify",
    });
}

// ===== Discord user取得 =====
async function getDiscordUser(code) {
  const token = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: 'https://bot.sakurahp.f5.si/admins/callback',
    }),
  }).then(r => r.json());

  return fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  }).then(r => r.json());
}

// ===== 管理者チェック =====
async function requireAdminuser(req, res, next) {
  const adminId = req.cookies.admin;
  if (!adminId) return res.redirect(adminOAuthURL());

  const { data } = await supabase
    .from("admins")
    .select("discord_id")
    .eq("discord_id", adminId)
    .single();

  if (!data) return res.sendStatus(401);
  next();
}

// 認証ページ
app.get('/auth/', cors(), (req, res) => {
  res.send(`
  <!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>さくら雑談王国認証ページ</title>
<link href="https://fonts.googleapis.com/css2?family=gg-sans:wght@400;700&display=swap" rel="stylesheet">
<style>
  body {
    font-family: 'gg-sans', 'Segoe UI', sans-serif;
    background: radial-gradient(circle at top, #2f3136 0%, #1e1f22 55%, #111214 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
    padding: 24px;
  }

  .card {
    width: min(520px, 100%);
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 16px;
    padding: 28px;
    box-shadow: 0 14px 35px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(4px);
  }

  h1 {
    text-align: center;
    margin: 0 0 8px;
  }

  p {
    text-align: center;
    margin: 0;
    color: rgba(255, 255, 255, 0.8);
  }

  a.button {
    display: block;
    text-align: center;
    padding: 15px 20px;
    margin-top: 20px;
    font-size: 17px;
    font-weight: bold;
    color: #fff;
    background: linear-gradient(120deg, #5b6ef5, #8f5cf6);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.45);
    text-decoration: none;
    box-shadow: 0 8px 18px rgba(91, 110, 245, 0.38);
    transition: 0.2s;
  }

  a.button:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 22px rgba(143, 92, 246, 0.45);
  }
</style>
</head>
<body>
  <div class="card">
    <h1>さくら雑談王国認証ページへようこそ</h1>
    <p>Discordアカウントでログインして、各種機能をご利用ください。</p>
    <a href="https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify" class="button">
      Discordで認証
    </a>
  </div>
</body>
</html>

  `);
});

// ルート: bot稼働中 + iframeでGASステータス読み込み
app.get('/', cors(), (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bot稼働状況</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: 32px 16px;
          background: linear-gradient(180deg, #eef3ff 0%, #f8fafc 100%);
          color: #0f172a;
        }
        .container {
          max-width: 920px;
          margin: 0 auto;
        }
        header {
          padding: 20px;
          text-align: center;
          background: linear-gradient(120deg, #5865F2, #7382ff);
          color: #fff;
          font-size: 1.5rem;
          border-radius: 14px;
          box-shadow: 0 10px 20px rgba(88, 101, 242, 0.25);
        }
        .card {
          margin-top: 18px;
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
          padding: 20px;
        }
        iframe {
          width: 100%;
          border: none;
          border-radius: 10px;
          box-shadow: inset 0 0 0 1px #e2e8f0;
          min-height: 160px;
        }
        .button {
          display: inline-block;
          margin-top: 8px;
          background: #0f172a;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 10px 14px;
          text-decoration: none;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>Bot稼働中🚀</header>
        <main class="card">
          <h2>ライブステータス</h2>
          <iframe id="statusFrame" src="https://script.google.com/macros/s/AKfycbwbh9oEmOWhNN9k_t86JmpKJZizPD_Ty4nSQxhusI1dJluwruXZET62nPgNupWVp9_p0A/exec" scrolling="no"></iframe>
          <h3>利用規約等</h3>
          <button class="button" onclick="location.href='https://kiyaku.bot.sakurahp.f5.si/'">利用規約&プライバリシーポリシーを見る</button>
        </main>
      </div>
      <script>
        const iframe = document.getElementById('statusFrame');
        window.addEventListener('message', (e) => {
          if (e.data.height) {
            iframe.style.height = e.data.height + 'px';
          }
        });
      </script>
    </body>
    </html>
  `);
});

// コールバック
// client は Discord.js で初期化したインスタンス名に合わせてください
app.get('/auth/callback', cors(), oauthCallbackLimiter, (req, res) => {
    handleOAuthCallback(req, res, client); 
});



// ===== 管理画面 =====
app.get("/admins", requireAdminuser, cors(), async (req, res) => {
  const { data } = await supabase
    .from("warned_users")
    .select("*")
    .order("updated_at", { ascending: false });

  const rows = (data || []).map(u => `
    <tr>
      <td>${u.discord_id}</td>
      <td>${u.reason}</td>
      <td>${new Date(u.updated_at).toLocaleString()}</td>
    </tr>
  `).join("");

  res.send(`
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>運営管理 - 危険ユーザー</title>
<style>
body { font-family: sans-serif; background:#eef2ff; padding:24px; color:#0f172a; }
h1 { margin-bottom:12px }
.panel { background:#fff; border-radius:12px; box-shadow:0 6px 14px rgba(0,0,0,0.08); padding:16px; }
table { border-collapse: collapse; width:100%; background:#fff; border-radius:8px; overflow:hidden; }
th, td { border-bottom:1px solid #e2e8f0; padding:10px; text-align:left; }
th { background:#f8fafc }
form { margin-top:20px; background:#fff; padding:15px; border-radius:10px; box-shadow:0 6px 14px rgba(0,0,0,0.08); }
input, textarea, button { width:100%; margin-top:5px; padding:10px; border-radius:8px; border:1px solid #cbd5e1; box-sizing:border-box; }
button { margin-top:12px; background:#4f46e5; color:#fff; border:none; font-weight:700; cursor:pointer; }
</style>
</head>
<body>

<div class="panel">
<h1>⚠ 危険ユーザー一覧</h1>

<table>
<tr>
  <th>Discord ID</th>
  <th>理由</th>
  <th>更新日時</th>
</tr>
${rows || "<tr><td colspan='3'>まだ登録なし</td></tr>"}
</table>
</div>

<h2>➕ 追加</h2>
<form method="POST" action="/admins/add">
  <label>Discord ID</label>
  <input name="targetId" required>

  <label>理由</label>
  <textarea name="reason" required></textarea>

  <button type="submit">追加する</button>
</form>

</body>
</html>
  `);
});

// ===== callback =====
app.get("/admins/callback", cors(), async (req, res) => {
  const code = req.query.code;
  if (!code) return res.sendStatus(401);

  const user = await getDiscordUser(code);

  const { data } = await supabase
    .from("admins")
    .select("discord_id")
    .eq("discord_id", user.id)
    .single();

  if (!data) return res.sendStatus(401);

  res.cookie("admin", user.id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24,
});

  res.redirect("/admins");
  
  });


// ===== 追加処理 =====
app.post(
  "/admins/add",
  requireAdminuser,
  cors({ origin: "https://bot.sakurahp.f5.si", credentials: true }),
  async (req, res) => {
  const { targetId, reason } = req.body;

  await supabase.from("warned_users").upsert({
    discord_id: targetId,
    reason,
    updated_at: new Date(),
  });

  res.redirect("/admins");
  }
);

const GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;

// JST 時刻
const nowJST = () =>
  new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

app.get("/api", cors(), async (req, res) => {
  try {
    // --- Discord REST (ギルド情報) ---
    const guildRes = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}?with_counts=true`, {
      headers: { Authorization: `Bot ${DISCORD_TOKEN}` }
    });
    // console.log("Response Headers:", Object.fromEntries(response.headers.entries));
    if (!guildRes.ok) throw new Error(`Guild fetch failed: ${guildRes.status}`);
    const guildData = await guildRes.json();

    // --- Owner 情報 ---
    const ownerRes = await fetch(
      `https://discord.com/api/v10/users/1208358513580052500`,
      { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
    );
    if (!ownerRes.ok) throw new Error(`Owner fetch failed: ${ownerRes.status}`);
    const ownerData = await ownerRes.json();

    // --- VC 情報（Gateway / client） ---
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) throw new Error("Guild not found in client");

    let totalVC = 0;
    const voice_detail = {};

    guild.channels.cache
      .filter(ch => ch.type === 2) // 2 = GuildVoice
      .forEach(ch => {
        const members = ch.members.map(m => m.user.id);

        if (members.length > 0) {
          voice_detail[ch.id] = members;
          totalVC += members.length;
        }
      });

    res.json({
      status: 200,
      timestamp: nowJST(),
      guild: {
        id: guildData.id,
        name: guildData.name,
        owner: guildData.owner_id,
        icon: guildData.icon
          ? `https://cdn.discordapp.com/icons/${guildData.id}/${guildData.icon}.png`
          : null,
        member: guildData.approximate_member_count || 0,
        online: guildData.approximate_presence_count || 0,
        voice: totalVC,
        voice_detail
      },
      owner: {
        id: ownerData.id,
        name: ownerData.username,
        icon: ownerData.avatar
          ? `https://cdn.discordapp.com/avatars/${ownerData.id}/${ownerData.avatar}.png`
          : null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: 500,
      error: err.message
    });
  }
});

app.get("/api/events", cors(), async (req, res) => {
  try {
    const eventsRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/scheduled-events?with_user_count=true`,
      { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
    );

    if (!eventsRes.ok) {
      throw new Error(`Events fetch failed: ${eventsRes.status}`);
    }

    const events = await eventsRes.json();

    // 整形（見やすくしたい場合）
    const formatted = events.map(ev => ({
      id: ev.id,
      name: ev.name,
      description: ev.description,
      creator_id: ev.creator_id,
      scheduled_start: ev.scheduled_start_time,
      scheduled_end: ev.scheduled_end_time,
      status: ev.status, // 1: Scheduled, 2: Active, 3: Completed, 4: Canceled
      entity_type: ev.entity_type, // 1: Stage, 2: Voice, 3: External
      user_count: ev.user_count || 0,
      channel_id: ev.channel_id,
      cover: ev.image
        ? `https://cdn.discordapp.com/guild-events/${ev.id}/${ev.image}.png`
        : null
    }));

    res.json({
      status: 200,
      timestamp: nowJST(),
      events: formatted
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: 500,
      error: err.message
    });
  }
});

//API側からバージョンを確認するため
app.get("/version", cors(), async (req, res) => {
  try{
    res.json({
             status: 200,
             version: "さくらbot V1"
      });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: 500,
      error: err.message
    });
  }
});

app.get("/api/invites/:code", cors(), async (req, res) => {
  const inviteCode = req.params.code
    .replace(".gg", "")
    .replace("discord.gg/", "")
    .replace("discord.com/invite/","");

  try {
    const response = await fetch(
      `https://discord.com/api/v10/invites/${inviteCode}?with_counts=true`,
      {
        method: "GET",
        headers: {
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        },
      }
    );

    if (response.status === 404) {
      return res.status(404).json({
        status: 404,
        message: "Invite not found or expired",
        match: false,
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        status: response.status,
        message: "Discord API error",
        match: false,
      });
    }

    const data = await response.json();

    // 招待コードのギルドID（存在しない場合もある）
    const inviteGuildId = data.guild?.id || null;

    // 一致判定
    const isMatch = inviteGuildId === GUILD_ID;

    return res.json({
      status: 200,
      invite: {
        code: data.code,
        guild: data.guild
          ? { id: data.guild.id, name: data.guild.name }
          : null,
        channel: data.channel
          ? { id: data.channel.id, name: data.channel.name }
          : null,
      },
      match: isMatch,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      status: 500,
      message: "Internal server error",
      match: false,
    });
  }
});

app.get("/shards/status", cors(), (_, res) => {
  if (!shardState.shards.length) {
    return res.status(503).json({
      ok: false,
      reason: "shard data not ready"
    });
  }
const date = new Date(shardState.updatedAt);
const localDateString = date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  res.json({
    ok: true,
    updatedAt: localDateString,
    shards: shardState.shards
  });
});

// 📌 /odai → HTML直書き + お題追加フォーム
app.get("/odai", cors(), (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress;

  console.log(clientIp);
  
  res.send(`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>今日のお題 管理ページ</title>
  <style>
    body { font-family: sans-serif; padding: 24px; background:#f8fafc; color:#0f172a; }
    .card { max-width: 760px; margin: 0 auto; background:#fff; border-radius:12px; padding:20px; box-shadow:0 8px 18px rgba(15,23,42,.08); }
    h1 { color: #0284c7; margin-top:0; }
    input, button { font-size: 1em; padding: 10px; margin-top: 8px; border-radius:8px; border:1px solid #cbd5e1; }
    button { background:#0ea5e9; color:#fff; border:none; cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
  <h1>今日のお題 追加ページ</h1>

  <h2>お題追加</h2>
  <form method="POST" action="/odai/add">
    <input type="text" name="topic" placeholder="<例: 好きな物は？>" required>
    <button type="submit">追加</button>
  </form>

  <h2>現在のお題一覧</h2>
  <ul id="topic-list"></ul>

  <script>
    async function fetchTopics() {
      const res = await fetch("/odai/list");
      const data = await res.json();
      const list = document.getElementById("topic-list");
      list.innerHTML = "";
      data.forEach(t => {
        const li = document.createElement("li");
        li.textContent = t.text + (t.used ? " ✅" : "");
        list.appendChild(li);
      });
    }
    fetchTopics();
  </script>
  </div>
</body>
</html>
  `);
});

// 📌 お題一覧 API
app.get("/odai/list", cors(), async (req, res) => {
  const { data, error } = await supabase
    .from("odai")
    .select("*")
    .order("id", { ascending: true });
  if (error) return res.json([]);
  res.json(data);
});

// 📌 お題追加 API（フォーム・JSON両方対応）
app.post("/odai/add", cors(), async (req, res) => {
  let topic = req.body.topic || (req.body.topic && req.body.topic.trim());
  if (!topic || topic.trim() === "") {
    return res.send("空のトピックは追加できません");
  }

  const { error } = await supabase
    .from("odai")
    .insert({ text: topic.trim(), used: false });

  if (error) return res.send("追加に失敗しました");

  // 追加後はページリロード
  res.redirect("/odai");
});

app.get('/gachas/login', cors(),  (req, res) => {
  const url =
    `https://discord.com/oauth2/authorize` +
    `?client_id=${DISCORD_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=identify`

  res.redirect(url)
})

app.get('/gachas/auth/callback', cors(), async (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).send('no code')

  // token取得
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI
    })
  })

  const token = await tokenRes.json()
  if (!token.access_token) return res.status(401).send('oauth failed')

  // user取得
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token.access_token}` }
  })
  const user = await userRes.json()

  // 管理者チェック
  if (!GACHA_ADMINS.includes(user.id)) {
    return res.status(403).send('not admin')
  }

  // session発行
  const sid = newSession(user.id, user.username)

  res.cookie('sid', sid, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 1000 * 60 * 60 * 6 // 6時間
  })

  res.redirect('/gachas/dashboard')
})

app.post('/gachas/logout', requireAuth, cors(), (req, res) => {
  sessions.delete(req.cookies.sid)
  res.clearCookie('sid')
  res.json({ ok: true })
})

app.get('/gachas/me', requireAuth, cors({origin: ['https://bot.sakurahp.f5.si'],credentials: true}), (req, res) => {
  res.json(req.user)
})

app.get('/gachas/sets', requireAuth, requireAdmin, cors({origin: ['https://bot.sakurahp.f5.si'],credentials: true}), async (req, res) => {
  const { data, error } = await supabase
    .from('gacha_sets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json(error)
  res.json(data)
})

app.post('/gachas/sets', requireAuth, requireAdmin, cors({origin: ['https://bot.sakurahp.f5.si'],credentials: true}), async (req, res) => {
  const { guild_id, name, channel_id, trigger_word } = req.body

  const { data, error } = await supabase
    .from('gacha_sets')
    .insert({
      guild_id,
      name,
      channel_id,
      trigger_word,
      enabled: false
    })
    .select()
    .single()

  if (error) return res.status(500).json(error)
  res.status(201).json(data)
})

app.patch('/gachas/sets/:setid', requireAuth, requireAdmin, cors({origin: ['https://bot.sakurahp.f5.si'],credentials: true}), async (req, res) => {
  const { setid } = req.params;
  const { name, channel_id, trigger_word, enabled } = req.body;

  const update = {};
   if (name !== undefined) update.name = name;
   if (channel_id !== undefined) update.channel_id = channel_id;
   if (trigger_word !== undefined) update.trigger_word = trigger_word;
   if (enabled !== undefined) update.enabled = enabled;

    // 何も変更が無い場合
    if (Object.keys(update).length === 0) {
      return res.status(204).json({ message: '更新内容がありません' })
    }

const { error } = await supabase
  .from('gacha_sets')
  .update(update)
  .eq('id', setid);

  if (error) return res.status(500).json(error)
  res.json({ ok: true })
});


app.delete('/gachas/sets/:setId', requireAuth, requireAdmin, cors({origin: ['https://bot.sakurahp.f5.si'],credentials: true}), async (req, res) => {
  const { setId } = req.params

  const { error } = await supabase
    .from('gacha_sets')
    .delete()
    .eq('id', setId)

  if (error) return res.status(500).json(error)
  res.json({ ok: true })
})

app.get('/gachas/sets/:setId/items', requireAuth, requireAdmin, cors({origin: ['https://bot.sakurahp.f5.si'],credentials: true}), async (req, res) => {
  const { setId } = req.params

  const { data, error } = await supabase
    .from('gacha_items')
    .select('*')
    .eq('set_id', setId)
    .order('display_id')

  if (error) return res.status(500).json(error)
  res.json(data)
})

app.post('/gachas/sets/:setId/items', cors({ origin: ['https://bot.sakurahp.f5.si'], credentials: true }), requireAuth, requireAdmin, 
  async (req, res) => {
    const { setId } = req.params;
    const items = Array.isArray(req.body) ? req.body : [req.body];

    try {
      // そのセット内での現在の最大 display_id を取得
      const { data: lastItem } = await supabase
        .from('gacha_items')
        .select('display_id')
        .eq('set_id', setId)
        .order('display_id', { ascending: false })
        .limit(1)
        .maybeSingle(); // single()だと0件の時エラーになるのでmaybeSingle

      let nextId = (lastItem?.display_id || 0) + 1;

      // 各アイテムに連番を割り当て
      const insertData = items.map(item => ({
        display_id: nextId++, // ここでセットごとの連番を付与
        set_id: setId,
        name: item.name,
        rarity: item.rarity,
        amount: item.amount,
        description: item.description || null
      }));

      const { error } = await supabase
        .from('gacha_items')
        .insert(insertData);

      if (error) throw error;

      await recalcProbabilitiesBySet(setId);
      res.status(201).json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
});

app.patch('/gachas/sets/:setId/items/:itemId',  requireAuth,  requireAdmin,  cors({ origin: ['https://bot.sakurahp.f5.si'], credentials: true }),  async (req, res) => {
    const { setId, itemId } = req.params
    const { name, description, amount, rarity } = req.body

    const update = {}
    if (name !== undefined) update.name = name
    if (description !== undefined) update.description = description
    if (amount !== undefined) update.amount = amount
    if (rarity !== undefined) update.rarity = rarity

    // 何も変更が無い場合
    if (Object.keys(update).length === 0) {
      return res.status(204).json({ message: '更新内容がありません' })
    }

    const { error } = await supabase
      .from('gacha_items')
      .update(update)
      .eq('id', itemId)
      .eq('set_id', setId)

    if (error) return res.status(500).json(error)

    await recalcProbabilitiesBySet(setId)
    res.json({ ok: true })
  }
)

app.delete('/gachas/sets/:setId/items/:itemId', requireAuth, requireAdmin, cors({origin: ['https://bot.sakurahp.f5.si'],credentials: true}), async (req, res) => {
  const { setId, itemId } = req.params

  const { error } = await supabase
    .from('gacha_items')
    .delete()
    .eq('id', itemId)
    .eq('set_id', setId)

  if (error) return res.status(500).json(error)

  await recalcProbabilitiesBySet(setId)
  res.json({ ok: true })
})

app.use('/gachas/dashboard', requireAuth, requireAdmin, cors({origin: ['https://bot.sakurahp.f5.si'],credentials: true}), express.static(path.join(process.cwd(), 'public', 'dashboard')));

async function recalcProbabilitiesBySet(setId){
  const { data: items, error } = await supabase
    .from('gacha_items')
    .select('rarity, amount')
    .eq('set_id', setId);
  if(error) throw new Error(error.message);
  if(!items || items.length === 0) return {};

  let totalWeight = 0;
  const raritySum = {};

  for(const item of items){
    const w = RARITY_WEIGHT[item.rarity] || 1;
    const v = item.amount * w;
    raritySum[item.rarity] = (raritySum[item.rarity] || 0) + v;
    totalWeight += v;
  }

  const probabilities = {};
  for(const r in raritySum){
    probabilities[r] = +(raritySum[r] / totalWeight * 100).toFixed(4);
  }

  await supabase
    .from('gacha_sets')
    .update({ probabilities })
    .eq('id', setId);

  return probabilities;
}

app.use((req,res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>404 Not Found</title>
      <style>
        body {
          margin: 0;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          color: #e5e7eb;
          font-family: system-ui, sans-serif;
        }
        .box {
          text-align: center;
        }
        h1 {
          font-size: 4rem;
          margin: 0;
        }
        p {
          opacity: 0.8;
        }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>404</h1>
        <p>このページは存在しません</p>
        <small>${req.originalUrl}</small>
      </div>
    </body>
    </html>
  `);
});

app.use(express.static("public"));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));
