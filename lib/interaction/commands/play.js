export default async function play(interaction, context) {
  const {
    ytdl,
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    entersState,
    StreamType,
    EmbedBuilder
  } = context;

  const url = interaction.options.getString("url");

  if (!ytdl.validateURL(url)) {
    return interaction.reply({
      content: "❌ 無効なYouTube URLです",
      ephemeral: true
    });
  }

  const channel = interaction.member.voice?.channel;
  if (!channel) {
    return interaction.reply({
      content: "🔊 先にボイスチャンネルに参加してね",
      ephemeral: true
    });
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setDescription("▶️ 再生準備中…")
        .setColor(0xaaaaaa)
    ]
  });

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false
  });

  const player = createAudioPlayer();
  connection.subscribe(player);

  const stream = ytdl(ytdl.getURLVideoID(url), {
    filter: format =>
      format.audioCodec === "opus" &&
      format.container === "webm",
    quality: "highest",
    highWaterMark: 32 * 1024 * 1024
  });

  const resource = createAudioResource(stream, {
    inputType: StreamType.WebmOpus
  });

  player.play(resource);

  try {
    await entersState(player, AudioPlayerStatus.Playing, 10_000);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setDescription("🎶 再生中")
          .setColor(0x55ff99)
      ]
    });

    await entersState(player, AudioPlayerStatus.Idle, 24 * 60 * 60 * 1000);
  } catch (e) {
    console.error(e);
    await interaction.editReply("⚠️ 再生に失敗しました");
  } finally {
    connection.destroy();
  }
}
