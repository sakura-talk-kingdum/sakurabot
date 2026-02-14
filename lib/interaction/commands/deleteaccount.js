export default async function deleteaccount(interaction, context) {
  const { PermissionFlagsBits, deleteUserAccount, MessageFlags } = context;
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "🚫 管理者じゃないとダメだよ！", flags: MessageFlags.Ephemeral });
  }

  try {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("user");
    await deleteUserAccount(targetUser.id);

    await interaction.editReply(
      `🗑️ **${targetUser.username}** のアカウント消したよ！`
    );
  } catch (err) {
    console.error(err);
    await interaction.followUp({ content: "⚠ エラーが起きたよ…", flags: MessageFlags.Ephemeral });
  }
}
