import { SlashCommandBuilder } from "discord.js";

export const data =   new SlashCommandBuilder()
    .setName('report')
    .setDescription('ユーザーを通報します')
    .addStringOption(option => option.setName('userid').setDescription('通報するユーザーID').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('通報理由').setRequired(true))
    .addAttachmentOption(option => option.setName('file').setDescription('証拠画像（任意）'));
