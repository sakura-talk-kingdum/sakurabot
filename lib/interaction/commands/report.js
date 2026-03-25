export default async function report(interaction, context) {
  const { client, MessageFlags, EmbedBuilder } = context;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const userid = interaction.options.getString('userid');
  const reason = interaction.options.getString('reason');
  const file = interaction.options.getAttachment('file');

  const reportEmbed = new EmbedBuilder()
    .setTitle('🚨 ユーザー通報')
    .setColor(0xED4245)
    .addFields(
      { name: '通報者', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
      { name: '対象ユーザー', value: `<@${userid}> (${userid})`, inline: true },
      { name: '理由', value: reason }
    )
    .setTimestamp();

  const reportChannel = await client.channels.fetch(1208987840462200882).catch(() => null);
  if (!reportChannel?.isTextBased()) return interaction.editReply('❌ 通報チャンネルが見つかりません');

  if (file) await reportChannel.send({ embeds: [reportEmbed], files: [{ attachment: file.url }] });
  else await reportChannel.send({ embeds: [reportEmbed] });

  return interaction.editReply('✅ 通報を送信しました！');
}
