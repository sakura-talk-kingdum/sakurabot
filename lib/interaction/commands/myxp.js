export default async function myxp(interaction, context) {
  const { fetchUserAccount, calculateUserLevel, MessageFlags } = context;
  try {
    await interaction.deferReply();

    const user = await fetchUserAccount(interaction.user.id);

    if (!user) {
      await interaction.editReply("まだアカウントがないみたいだよ");
      return;
    }

    // text + voice 合算レベルにしたいならこれ
    const totalXp = user.text_xp + user.voice_xp;
    const level = calculateUserLevel(totalXp);

    await interaction.editReply(
      `🌱 **${interaction.user.username} のステータス**\n` +
      `📝 Text XP: **${user.text_xp}** (Lv.${user.text_level})\n` +
      `🎤 Voice XP: **${user.voice_xp}** (Lv.${user.voice_level})\n` +
      `🌟 合計レベル: **${level}**`
    );
  } catch (err) {
    console.error(err);
    await interaction.followUp({ content: "⚠ エラーが起きたよ…", flags: MessageFlags.Ephemeral });
  }
}
