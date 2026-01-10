import { SlashCommandBuilder } from "discord.js";

export const data =   new SlashCommandBuilder()
    .setName("modalview")
    .setDescription("モーダル集計を見る / CSV出力")
    .addStringOption(option => option.setName("id").setRequired(true))
    .addBooleanOption(option => option.setName("csv"));