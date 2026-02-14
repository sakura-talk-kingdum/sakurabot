export default async function admin(interaction, context) {
  const { createAccount, deleteAccount, transferAccount, modifyXP, modifyLevel } = context;
  const sub = interaction.options.getSubcommand(false);

  // アカウント作成
  if (sub === "account-create") {
    await interaction.deferReply({ ephemeral: false });
    const user = interaction.options.getUser("user");
    const res = await createAccount(user.id);

    if (res.error === "AccountAlreadyExists")
      return interaction.editReply("そのユーザーはもう登録済みだよ！");

    return interaction.editReply(`アカウント作成完了！`);
  }

  // アカウント削除
  if (sub === "account-delete") {
    await interaction.deferReply({ ephemeral: false });
    const user = interaction.options.getUser("user");
    await deleteAccount(user.id);
    return interaction.editReply("削除完了！");
  }

  // アカウント移行
  if (sub === "account-transfer") {
    await interaction.deferReply({ ephemeral: false });

    const oldUser = interaction.options.getUser("old");
    const newUser = interaction.options.getUser("new");

    const res = await transferAccount(oldUser.id, newUser.id);

    if (res.error)
      return interaction.editReply(`エラー: ${res.error}`);

    return interaction.editReply("アカウント移行完了したよ！");
  }

  // XP操作
  if (sub === "account-xp") {
    await interaction.deferReply({ ephemeral: false });
    const user = interaction.options.getUser("user");
    const type = interaction.options.getString("type");
    const value = interaction.options.getInteger("value");

    await modifyXP(user.id, type, value);
    return interaction.editReply(`XP を ${type} で ${value} 変更したよ！`);
  }

  // Level操作
  if (sub === "account-level") {
    await interaction.deferReply({ ephemeral: false });
    const user = interaction.options.getUser("user");
    const type = interaction.options.getString("type");
    const value = interaction.options.getInteger("value");

    await modifyLevel(user.id, type, value);
    return interaction.editReply(`Level を ${type} で ${value} 変更したよ！`);
  }
}
