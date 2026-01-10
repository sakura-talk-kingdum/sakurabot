import { SlashCommandBuilder } from "discord.js";

export const data =  new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('タイムアウトを解除します')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('対象ユーザー')
        .setRequired(true)
    );