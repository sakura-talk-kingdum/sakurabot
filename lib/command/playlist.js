import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("playlist")
  .setDescription("現在の再生キューを表示します");
