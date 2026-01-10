import { SlashCommandBuilder } from "discord.js";

export const data =  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('ユーザーをタイムアウトします')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('対象ユーザー')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('time')
        .setDescription('時間 (例: 1h 10m)')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason')
        .setDescription('理由')
        .setRequired(false)
    );
