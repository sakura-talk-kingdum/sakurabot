import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("play")
  .setDescription("YouTube の音声を再生キューに追加します")
  .addStringOption(option =>
    option
      .setName("url")
      .setDescription("YouTube URL または検索ワード")
      .setRequired(true)
  );
