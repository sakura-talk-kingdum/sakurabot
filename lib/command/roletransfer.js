import { SlashCommandBuilder, PermissionsBitField } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("roletransfer")
  .setDescription("ロールを移行します")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);
