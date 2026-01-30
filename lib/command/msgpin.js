import { SlashCommandBuilder , PermissionsBitField } from "discord.js";

export const data =  new SlashCommandBuilder()
    .setName('msgpin')
    .setDescription('チャンネルにメッセージを固定します')
    .addStringOption(option => option.setName('msg').setDescription('固定する内容').setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);
