export default async function timeout(interaction, context) {
  const { PermissionFlagsBits, parseDuration, logModerationAction } = context;
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
    await interaction.reply({ content: '権限がありません', ephemeral: true });
    return;
  }
  await interaction.deferReply();
  const user = interaction.options.getUser('user');
  const timeStr = interaction.options.getString('time');
  const reason = interaction.options.getString('reason') ?? '理由なし';

  const duration = parseDuration(timeStr);
  if (!duration || duration <= 0) {
    await interaction.editReply({ content: '時間指定が不正です', ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(user.id);

  if (!member.moderatable) {
    await interaction.editReply({ content: 'このユーザーはタイムアウトできません', ephemeral: true });
    return;
  }

  await member.timeout(duration, reason);

  await logModerationAction({
    guild: interaction.guild,
    action: "TIMEOUT",
    target: user,
    moderator: interaction.user,
    reason,
    durationMs: duration
  });

  await interaction.editReply({
    content: `⏱ **${user.tag}** を **${timeStr}** タイムアウトしました`
  });
}
