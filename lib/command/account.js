import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("account")
  .setDescription("アカウント情報の確認/設定")
  .addSubcommand(sub =>
    sub
      .setName("info")
      .setDescription("アカウント情報を表示します")
      .addUserOption(option =>
        option
          .setName("user")
          .setDescription("表示対象ユーザー（省略時は自分）")
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName("settings")
      .setDescription("SNS設定を更新します")
      .addStringOption(option =>
        option
          .setName("set")
          .setDescription("設定カテゴリ")
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("type")
          .setDescription("SNSの種類")
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName("value")
          .setDescription("設定値")
          .setRequired(true)
      )
  );
