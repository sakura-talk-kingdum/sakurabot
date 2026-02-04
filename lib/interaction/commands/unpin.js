export default async function unpin(interaction, context) {
  const { PermissionFlagsBits, getPinnedByChannel, deletePinned, MessageFlags } = context;
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '権限がありません', ephemeral: true });
    return;
  }

  const channelId = interaction.channel.id;
  const existing = await getPinnedByChannel(channelId);
  if (!existing) return interaction.reply({ content: '❌ このチャンネルには固定メッセージがありません', flags: MessageFlags.Ephemeral});

  const pinnedMsgId = existing.message_id;
  const msg = await interaction.channel.messages.fetch(pinnedMsgId).catch(() => null);
  if (msg) await msg.delete().catch(() => {});
  await deletePinned(channelId);

  return interaction.reply({ content: '🗑️ 固定メッセージを解除しました！', flags: MessageFlags.Ephemeral});
}
