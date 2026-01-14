import { SlashCommandBuilder } from "discord.js";

export const data =  new SlashCommandBuilder()
    .setName('unpin')
    .setDescription('チャンネルにあるメッセージ固定を解除します')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);
