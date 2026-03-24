export default async function selfto(interaction, context) {
  const {
    parseDurationDetailed,
    scheduleTimeoutContinuation,
    clearTimeoutContinuation
  } = context;

  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'サーバー内でのみ実行できます', ephemeral: true });
    return;
  }

  const user = interaction.user;
  const timeStr = interaction.options.getString('time') ?? '1d';
  const detail = parseDurationDetailed(timeStr);
  const duration = detail.cappedMs;

  if (!duration || duration <= 0) {
    await interaction.reply({ content: '時間指定が不正です', ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(user.id);

  if (!member.moderatable) {
    await interaction.reply({ content: 'あなたはタイムアウトできません', ephemeral: true });
    return;
  }

  await member.timeout(duration, 'Self timeout by /selfto');

  if (detail.totalMs > detail.cappedMs && !detail.usedMax) {
    await scheduleTimeoutContinuation({
      guildId: interaction.guild.id,
      userId: user.id,
      reason: 'Self timeout by /selfto',
      targetUntil: detail.targetUntil,
      nextApplyAt: detail.nextApplyAt
    });
  } else {
    await clearTimeoutContinuation(interaction.guild.id, user.id);
  }

  await interaction.reply({
    content: detail.totalMs > detail.cappedMs && !detail.usedMax
      ? '⏱ 自分自身をまず最大期間でタイムアウトしました。期限まで自動で再適用します。解除はDMで `/unselfto` を送信してください。'
      : `⏱ 自分自身を **${timeStr}** タイムアウトしました。解除はDMで \`/unselfto\` を送信してください。`,
    ephemeral: true
  });
}
