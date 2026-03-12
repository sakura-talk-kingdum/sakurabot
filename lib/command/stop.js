import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("stop")
  .setDescription("再生を停止してボイスチャンネルから退出します");
