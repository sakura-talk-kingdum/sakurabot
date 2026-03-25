export default async function timeout(interaction, context) {
  const {
    PermissionFlagsBits,
    parseDurationDetailed,
    scheduleTimeoutContinuation,
    clearTimeoutContinuation
  } = context;
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: 'サーバー内でのみ実行できます', ephemeral: true });
    return;
  }

  if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
    await interaction.reply({ content: '権限がありません', ephemeral: true });
    return;
  }

  const user = interaction.options.getUser('user');
  const timeStr = interaction.options.getString('time');
  const reason = interaction.options.getString('reason') ?? '理由なし';

  const detail = parseDurationDetailed(timeStr);
  const duration = detail.cappedMs;
  if (!duration || duration <= 0) {
    await interaction.reply({ content: '時間指定が不正です', ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(user.id);

  if (!member.moderatable) {
    await interaction.reply({ content: 'このユーザーはタイムアウトできません', ephemeral: true });
    return;
  }

  await member.timeout(duration, reason);

  if (detail.totalMs > detail.cappedMs && !detail.usedMax) {
    await scheduleTimeoutContinuation({
      guildId: interaction.guild.id,
      userId: user.id,
      reason,
      targetUntil: detail.targetUntil,
      nextApplyAt: detail.nextApplyAt
    });
  } else {
    await clearTimeoutContinuation(interaction.guild.id, user.id);
  }

  await interaction.reply({
    content: detail.totalMs > detail.cappedMs && !detail.usedMax
      ? `⏱ **${user.tag}** をまず最大期間でタイムアウトしました。期限まで自動で再適用します。`
      : `⏱ **${user.tag}** を **${timeStr}** タイムアウトしました`
  });
}
