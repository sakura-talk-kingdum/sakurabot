export default async function stop(interaction, context) {
  const { queues } = context;
  const guildQueue = queues.get(interaction.guild.id);
  if (!guildQueue) return interaction.reply('⚠️ 何も再生してないよ！');
  guildQueue.songs = [];
  guildQueue.player.stop();
  if (guildQueue.connection) guildQueue.connection.destroy();
  queues.delete(interaction.guild.id);
  interaction.reply('🛑 再生を停止して退出したよ！');
}
