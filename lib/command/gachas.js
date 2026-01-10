import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("gachas")
  .setDescription("ガチャ関連コマンド")

  // ---------- /gachas inventory ----------
  .addSubcommand(sc =>
    sc
      .setName("inventory")
      .setDescription("ユーザーのガチャ所持状況を見る")
      .addUserOption(opt =>
        opt
          .setName("user")
          .setDescription("対象ユーザー")
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName("gachas")
          .setDescription("ガチャ名")
          .setRequired(true)
      )
  )

  // ---------- /gachas search ----------
  .addSubcommand(sc =>
    sc
      .setName("search")
      .setDescription("ガチャを名前で検索")
      .addStringOption(opt =>
        opt
          .setName("name")
          .setDescription("検索するガチャ名")
          .setRequired(true)
      )
  );
