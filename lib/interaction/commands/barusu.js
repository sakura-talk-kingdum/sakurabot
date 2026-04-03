export default async function barusu(interaction, context) {
  const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    getVoiceConnection,
    path,
    fileURLToPath
  } = context;

  const member = interaction.member;

  if (!member.voice.channel) {
    return interaction.reply({
      content: "❌ 先にボイスチャンネル入って",
      flags: 64
    });
  }

  const channel = member.voice.channel;

  // __dirname 再構築
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // VC接続
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: interaction.guild.id,
    adapterCreator: interaction.guild.voiceAdapterCreator
  });

  const player = createAudioPlayer();
  const resource = createAudioResource(
    path.join(__dirname, "barusu.mp3")
  );

  connection.subscribe(player);
  player.play(resource);

  await interaction.reply({
    content: "💥 バルス発動",
    flags: 64
  });

  // 再生終了で即退出
  player.on(AudioPlayerStatus.Idle, () => {
    const conn = getVoiceConnection(interaction.guild.id);
    if (conn) conn.destroy();
  });

  player.on("error", (e) => {
    console.error(e);
    const conn = getVoiceConnection(interaction.guild.id);
    if (conn) conn.destroy();
  });
}
