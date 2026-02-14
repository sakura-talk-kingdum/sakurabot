import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("deleteaccount")
  .setDescription("ユーザーのアカウントを削除します")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("削除対象のユーザー")
      .setRequired(true)
  );
