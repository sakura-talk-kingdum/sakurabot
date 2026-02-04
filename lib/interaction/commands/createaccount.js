export default async function createaccount(interaction, context) {
  const { PermissionFlagsBits, createUserAccount, MessageFlags } = context;
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: "🚫 このコマンドは管理者専用だよ〜！",
      flags: MessageFlags.Ephemeral
    });
  }

  try {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("user");
    await createUserAccount(targetUser.id);

    await interaction.editReply(
      `🎉 **${targetUser.username}** のアカウント作ったよ！`
    );

  } catch (error) {
    console.error("❌ createaccount実行中にエラー:", error);

    // defer が成功してるかどうかは関係なく fallback でOK
    try {
      await interaction.followUp({
        content: "⚠ エラーが起きたかも…！もう一度試してみてね！",
        flags: MessageFlags.Ephemeral
      });
    } catch {}
  }
}
