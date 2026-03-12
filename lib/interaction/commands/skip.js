export default async function skip(interaction, context) {
  const { queues } = context;
  const guildQueue = queues.get(interaction.guild.id);
  if (!guildQueue || guildQueue.songs.length <= 1)
    return interaction.reply('⚠️ スキップできる曲がないよ！');
  guildQueue.player.stop(true);
  interaction.reply('⏭️ スキップしたよ！');
}
