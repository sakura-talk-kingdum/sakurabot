export default async function untimeout(interaction, context) {
  const { PermissionFlagsBits, logModerationAction } = context;
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
    await interaction.reply({ content: '権限がありません', ephemeral: true });
    return;
  }

  const user = interaction.options.getUser('user');
  const member = await interaction.guild.members.fetch(user.id);

  if (!member.moderatable) {
    await interaction.reply({ content: 'このユーザーは解除できません', ephemeral: true });
    return;
  }

  await member.timeout(null);

  await logModerationAction({
    guild: interaction.guild,
    action: "UNTIMEOUT",
    target: user,
    moderator: interaction.user,
    reason: "manual untimeout"
  });

  await interaction.reply({
    content: `✅ **${user.tag}** のタイムアウトを解除しました`
  });
}
