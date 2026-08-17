import { SlashCommandBuilder } from 'discord.js';

// コマンド一覧（commands 配列）にこれを追加する
export const data = new SlashCommandBuilder()
  .setName('launch') // 任意の名前（例: launch）
  .setDescription('アプリを起動します')
  .setIntegrationTypes([0, 1]) // 💡 重要: 統合タイプの設定（GUILD_INSTALL=0, USER_INSTALL=1）
  .setContexts([0, 1, 2]);      // 💡 重要: コンテキストの設定（GUILD=0, BOT_DM=1, PRIVATE_CHANNEL=2）
  .setType(4);
