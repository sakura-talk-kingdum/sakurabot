import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("modal")
  .setDescription("モーダル版投票を作成")
  .addStringOption(option => option.setName("title").setDescription("タイトル").setRequired(true))
  .addStringOption(option => option.setName("description").setDescription("説明文").setRequired(true))
  .addStringOption(option => option.setName("modaltitle").setDescription("モーダルのタイトル").setRequired(true))
  .addStringOption(option => option.setName("id").setDescription("カスタムID").setRequired(true))
  .addStringOption(option => option.setName("name1").setDescription("項目1の名前").setRequired(true))
  .addStringOption(option =>
    option.setName("type1").setDescription("項目1の形式").setRequired(true)
      .addChoices(
        { name: "短文", value: "SHORT" },
        { name: "長文", value: "PARA" }
      )
  ) 
  .addStringOption(option => option.setName("name2").setDescription("項目2の名前").setRequired(false))
  .addStringOption(option =>
    option.setName("type2").setDescription("項目2の形式").setRequired(false)
      .addChoices(
        { name: "短文", value: "SHORT" },
        { name: "長文", value: "PARA" }
      )
  ) 
  .addStringOption(option => option.setName("name3").setDescription("項目3の名前").setRequired(false))
  .addStringOption(option =>
    option.setName("type3").setDescription("項目3の形式").setRequired(false)
      .addChoices(
        { name: "短文", value: "SHORT" },
        { name: "長文", value: "PARA" }
      )
  ) 
  .addStringOption(option => option.setName("name4").setDescription("項目4の名前").setRequired(false))
  .addStringOption(option =>
    option.setName("type4").setDescription("項目4の形式").setRequired(false)
      .addChoices(
        { name: "短文", value: "SHORT" },
        { name: "長文", value: "PARA" }
      )
  ) 
  .addStringOption(option => option.setName("name5").setDescription("項目5の名前").setRequired(false))
  .addStringOption(option =>
    option.setName("type5").setDescription("項目5の形式").setRequired(false)
      .addChoices(
        { name: "短文", value: "SHORT" },
        { name: "長文", value: "PARA" }
      ) 
  );
