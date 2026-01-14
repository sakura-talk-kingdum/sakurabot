import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("imihubun")
  .setDescription("[飼育員]imihubunを送信")
  .addChannelOption(option =>
    option
      .setName("channel")
      .setDescription("送信先チャンネル")
      .setRequired(true)
  );
