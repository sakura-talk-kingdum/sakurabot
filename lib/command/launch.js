import { SlashCommandBuilder } from 'discord.js';

// 基本のデータをビルダーで作成（セミコロンの位置を修正）
const baseCommand = new SlashCommandBuilder()
  .setName('launch')
  .setDescription('アプリを起動します')
  .setIntegrationTypes([0, 1]) // 0: GUILD_INSTALL, 1: USER_INSTALL
  .setContexts([0, 1, 2]);      // 0: GUILD, 1: BOT_DM, 2: PRIVATE_CHANNEL

// toJSON() したオブジェクトに対して、直接 type: 4 (Primary Entry Point) を付与してエクスポートする
export const data = {
  ...baseCommand.toJSON(),
  type: 4 // ApplicationCommandType.PrimaryEntryPoint
};
