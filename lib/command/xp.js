import SlashCommandBuilder from "discord.js";

export const data = new SlashCommandBuilder()
  .setName('xp')
  .setDescription('XPステータスやランキングを表示します')
  // 引数1: 個人表示用のユーザー選択
  .addUserOption(option => 
    option.setName('user')
      .setDescription('ステータスを見たいユーザーを選択 (未指定なら自分)')
      .setRequired(false))
