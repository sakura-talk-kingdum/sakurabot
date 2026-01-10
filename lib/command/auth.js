import { SlashCommandBuilder, PermissionsBitField } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("auth")
  .setDescription("認証用リンクを表示します")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);
