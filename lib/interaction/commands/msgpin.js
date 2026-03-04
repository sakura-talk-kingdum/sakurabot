export default async function msgpin(interaction, context) {
  const { PermissionFlagsBits, EmbedBuilder, upsertPinned } = context;
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '権限がありません', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const msg = interaction.options.getString('msg');
  const channelId = interaction.channel.id;

  const embed = new EmbedBuilder()
    .setDescription(msg)
    .setColor(0x00AE86)
    .setFooter({ text: `📌 投稿者: ${interaction.user.tag}` })
    .setTimestamp();

  const sent = await interaction.channel.send({ embeds: [embed] });
  await upsertPinned(channelId, sent.id, msg, interaction.user.tag);

  return interaction.editReply({ content: '📌 メッセージを固定しました！' });
}
