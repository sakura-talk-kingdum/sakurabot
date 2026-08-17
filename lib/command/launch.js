import { SlashCommandBuilder } from 'discord.js';

// 1. まずはBuilderで基本情報を組み立てる
const baseCommand = new SlashCommandBuilder()
  .setName('launch')
  .setDescription('アプリを起動します');

// 2. JSONオブジェクトに変換し、特殊なプロパティを直接結合してエクスポートする
export const data = {
  ...baseCommand.toJSON(),
  type: 4,                       // PrimaryEntryPointを指定
  integration_types: [0, 1],     // 💡 REST用なのでスネークケースで記述
  contexts: [0, 1, 2]            // 💡 REST用なのでスネークケースで記述
};
