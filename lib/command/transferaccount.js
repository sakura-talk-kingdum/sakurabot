import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("transferaccount")
  .setDescription("アカウントデータを別ユーザーへ移行します")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option =>
    option
      .setName("from")
      .setDescription("移行元ユーザー")
      .setRequired(true)
  )
  .addUserOption(option =>
    option
      .setName("to")
      .setDescription("移行先ユーザー")
      .setRequired(true)
  );
