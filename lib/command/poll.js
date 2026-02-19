import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("poll")
  .setDescription("投票を作成します")
  .addStringOption(option =>
    option
      .setName("title")
      .setDescription("投票タイトル")
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName("data")
      .setDescription("例: a_'りんご',b_'みかん'")
      .setRequired(true)
  );
