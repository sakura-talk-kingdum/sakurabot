export default async function playlist(interaction, context) {
  const { queues } = context;
  const guildQueue = queues.get(interaction.guild.id);
  if (!guildQueue || guildQueue.songs.length === 0)
    return interaction.reply('📭 再生中のプレイリストは空っぽ！');

  const list = guildQueue.songs
    .map((s, i) => `${i === 0 ? '▶️' : `${i}.`} ${s.title}`)
    .join('\n');
  interaction.reply(`🎵 **再生キュー:**\n${list}`);
}
