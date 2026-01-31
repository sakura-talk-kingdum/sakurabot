import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("modalview")
  .setDescription("モーダル集計を見る / CSV出力")
  .addStringOption(option =>
    option
      .setName("id")
      .setDescription("モーダルのIDを指定してください")
      .setRequired(true)
  )
  .addBooleanOption(option =>
    option
      .setName("csv")
      .setDescription("CSV出力する場合は true")
  );
