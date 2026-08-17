import { SlashCommandBuilder, PermissionsBitField } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("top")
  .setDescription("XPランキングを表示します。")
  .addStringOption(option => 
    option.setName('type')
      .setDescription('ランキングを表示したい場合は種類を選択してください')
      .setRequired(false)
      .addChoices(
        { name: '💬 テキストランキング', value: 'text' },
        { name: '🎙️ ボイスランキング', value: 'vc' }
      ))
  .addIntegerOption(option => 
    option.setName('range')
      .setDescription('ランキングのページ番号 (1ページごとに10位ずつ表示)')
      .setRequired(false));
