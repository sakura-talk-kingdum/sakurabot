import { ShardingManager } from "discord.js";
import dotenv from "dotenv";
import https from "https";
import "./web.js";

dotenv.config();

export const shardState = {
  updatedAt: 0,
  shards: []
};

const totalShards = 2;

const PRIMARY_SHARD_ID = 0;

async function syncShardRoles() {
  try {
    await manager.broadcastEval(
      (client, { primaryShardId }) => {
        globalThis.__SAKURA_SHARD_ROLE__ = {
          primaryShardId,
          shardId: client.shard.ids[0],
          isPrimary: client.shard.ids[0] === primaryShardId,
          syncedAt: Date.now()
        };

        return globalThis.__SAKURA_SHARD_ROLE__;
      },
      { context: { primaryShardId: PRIMARY_SHARD_ID } }
    );
  } catch (e) {
    console.error("❌ shard role sync failed", e);
  }
}

const manager = new ShardingManager("./bot.js", {
  token: process.env.DISCORD_BOT_TOKEN,
  totalShards
});

manager.on("shardCreate", shard => {
  console.log(`🧩 シャード ${shard.id} 起動`);
});

// ⭐ shard 状態取得（重要）
async function updateShardState() {
  try {
    const results = await manager.broadcastEval(client => ({
      shardId: client.shard.ids[0],
      ready: client.isReady(),
      ping: client.ws.ping,
      guilds: client.guilds.cache.size,
      uptime: client.uptime
    }));

    shardState.updatedAt = Date.now();
    shardState.shards = results;

  } catch (e) {
    console.error("❌ shard status fetch failed", e);
  }
}

manager.spawn().then(() => {
  syncShardRoles();
  updateShardState();

  setInterval(syncShardRoles, 60_000);
  setInterval(updateShardState, 60_000); // 1分で十分
});

setInterval(() => {
  const req = https.get("https://bot.sakurahp.f5.si/", res => {
    res.resume(); // データ捨てる（重要）
  });

  req.on("error", err => {
    console.error("[KeepAlive Error]", err.message);
  });

  req.setTimeout(5000, () => {
    req.destroy();
    console.error("[KeepAlive Timeout]");
  });
}, 120_000);
