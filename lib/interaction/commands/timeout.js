export default async function timeout(interaction, context) {
  const { PermissionFlagsBits, parseDuration } = context;
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
    await interaction.reply({ content: '権限がありません', ephemeral: true });
    return;
  }

  const user = interaction.options.getUser('user');
  const timeStr = interaction.options.getString('time');
  const reason = interaction.options.getString('reason') ?? '理由なし';

  const duration = parseDuration(timeStr);
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

  await interaction.reply({
    content: `⏱ **${user.tag}** を **${timeStr}** タイムアウトしました`
  });
}
