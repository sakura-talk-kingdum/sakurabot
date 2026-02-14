import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

const operationChoices = [
  { name: "add", value: "add" },
  { name: "set", value: "set" },
  { name: "remove", value: "remove" }
];

export const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("管理者向けアカウント操作")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub
      .setName("account-create")
      .setDescription("ユーザーのアカウントを作成")
      .addUserOption(option =>
        option.setName("user").setDescription("対象ユーザー").setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName("account-delete")
      .setDescription("ユーザーのアカウントを削除")
      .addUserOption(option =>
        option.setName("user").setDescription("対象ユーザー").setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName("account-transfer")
      .setDescription("アカウントを別ユーザーに移行")
      .addUserOption(option =>
        option.setName("old").setDescription("移行元ユーザー").setRequired(true)
      )
      .addUserOption(option =>
        option.setName("new").setDescription("移行先ユーザー").setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName("account-xp")
      .setDescription("XPを操作")
      .addUserOption(option =>
        option.setName("user").setDescription("対象ユーザー").setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("type")
          .setDescription("操作種別")
          .setRequired(true)
          .addChoices(...operationChoices)
      )
      .addIntegerOption(option =>
        option.setName("value").setDescription("変更量").setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName("account-level")
      .setDescription("レベルを操作")
      .addUserOption(option =>
        option.setName("user").setDescription("対象ユーザー").setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("type")
          .setDescription("操作種別")
          .setRequired(true)
          .addChoices(...operationChoices)
      )
      .addIntegerOption(option =>
        option.setName("value").setDescription("変更量").setRequired(true)
      )
  );
