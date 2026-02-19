import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("createaccount")
  .setDescription("ユーザーのアカウントを作成します")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("作成対象のユーザー")
      .setRequired(true)
  );
