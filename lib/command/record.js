import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("record")
  .setDescription("VC録音の開始/停止")
  .addSubcommand(sub =>
    sub
      .setName("start")
      .setDescription("録音を開始します")
  )
  .addSubcommand(sub =>
    sub
      .setName("stop")
      .setDescription("録音を停止します")
  );
