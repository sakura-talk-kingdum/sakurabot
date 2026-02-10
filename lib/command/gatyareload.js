import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("gatyareload")
  .setDescription("ガチャ設定を再読み込みします")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
