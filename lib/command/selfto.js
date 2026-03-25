import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName('selfto')
  .setDescription('自分自身をタイムアウトします')
  .addStringOption(o =>
    o.setName('time')
      .setDescription('時間 (例: 1d, 12h, 1w 2d, max)')
      .setRequired(false)
  );
