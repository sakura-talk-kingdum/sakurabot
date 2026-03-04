export default async function transferaccount(interaction, context) {
  const { PermissionFlagsBits, transferUserAccount, MessageFlags } = context;
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "🚫 権限足りないよ！", flags: MessageFlags.Ephemeral });
  }

  try {
    await interaction.deferReply();

    const fromUser = interaction.options.getUser("from");
    const toUser = interaction.options.getUser("to");

    await transferUserAccount(fromUser.id, toUser.id);

    await interaction.editReply(
      `🔁 **${fromUser.username} → ${toUser.username}** にデータ移行したよ！`
    );
  } catch (err) {
    console.error(err);
    await interaction.followUp({ content: "⚠ エラーが起きたよ…", flags: MessageFlags.Ephemeral });
  }
}
