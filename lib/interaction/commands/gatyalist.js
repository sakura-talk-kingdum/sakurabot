export default async function gatyalist(interaction, context) {
  const { forumThreadsData, EmbedBuilder, MessageFlags } = context;
  try {
    if (forumThreadsData.length === 0) {
      return interaction.reply({ content: '❌ ガチャデータが読み込まれていません', flags: MessageFlags.Ephemeral });
    }

    const embeds = forumThreadsData.map(thread => {
      const msgList = thread.messages.map(m => m.probability ? `${m.text} [${m.probability}]` : m.text);
      return new EmbedBuilder()
        .setTitle(thread.title)
        .setDescription(msgList.join('\n') || 'メッセージなし')
        .setFooter({ text: `Reply Channel: ${thread.replyChannel || '未設定'}` })
        .setColor(0xFFD700)
        .setTimestamp();
    });

    // Embed は 1 回に最大 10 件まで
    for (let i = 0; i < embeds.length; i += 10) {
      await interaction.reply({ embeds: embeds.slice(i, i + 10), flags: MessageFlags.Ephemeral });
    }
  } catch (e) {
    interaction.reply("エラー:" + e);
  }
}
