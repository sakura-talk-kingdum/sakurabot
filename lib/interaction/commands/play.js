async function resolveTrack(query, playdl) {
  const ytType = playdl.yt_validate(query);
  if (ytType === "video") {
    const info = await playdl.video_info(query);
    return {
      title: info.video_details.title,
      url: info.video_details.url
    };
  }

  const results = await playdl.search(query, { limit: 1 });
  if (!results.length) return null;

  return {
    title: results[0].title,
    url: results[0].url
  };
}

function ensureQueue(context, interaction, channel) {
  const {
    queues,
    joinVoiceChannel,
    createAudioPlayer,
    AudioPlayerStatus,
    playdl,
    createAudioResource
  } = context;
  const guildId = interaction.guild.id;

  let guildQueue = queues.get(guildId);
  if (!guildQueue) {
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });

    const player = createAudioPlayer();

    guildQueue = {
      connection,
      player,
      songs: []
    };
  }

  if (guildQueue._listenersInitialized) return guildQueue;

  const playNext = async () => {
    const song = guildQueue.songs[0];
    if (!song) {
      if (guildQueue.connection) guildQueue.connection.destroy();
      queues.delete(guildId);
      return;
    }

    try {
      const stream = await playdl.stream(song.url, {
        discordPlayerCompatibility: true
      });
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type
      });
      guildQueue.player.play(resource);
    } catch (err) {
      console.error("Audio stream error", err);
      guildQueue.songs.shift();
      playNext();
    }
  };

  guildQueue.playNext = playNext;
  guildQueue._listenersInitialized = true;

  guildQueue.player.on(AudioPlayerStatus.Idle, () => {
    guildQueue.songs.shift();
    guildQueue.playNext();
  });

  guildQueue.player.on("error", err => {
    console.error("Audio player error", err);
    guildQueue.songs.shift();
    guildQueue.playNext();
  });

  if (guildQueue.connection) {
    guildQueue.connection.subscribe(guildQueue.player);
  }
  queues.set(guildId, guildQueue);

  return guildQueue;
}

export default async function play(interaction, context) {
  const { queues, EmbedBuilder } = context;

  const query = interaction.options.getString("url");
  const channel = interaction.member.voice?.channel;
  if (!channel) {
    return interaction.reply({
      content: "🔊 先にボイスチャンネルに参加してね",
      ephemeral: true
    });
  }

  let track;
  try {
    track = await resolveTrack(query, context.playdl);
  } catch (err) {
    console.error(err);
  }

  if (!track) {
    return interaction.reply({
      content: "❌ 再生できる動画が見つからなかったよ",
      ephemeral: true
    });
  }

  const guildQueue = ensureQueue(context, interaction, channel);
  if (
    guildQueue.connection?.joinConfig?.channelId &&
    guildQueue.connection.joinConfig.channelId !== channel.id
  ) {
    return interaction.reply({
      content: "⚠️ すでに別のボイスチャンネルで再生中だよ",
      ephemeral: true
    });
  }

  guildQueue.songs.push(track);

  if (guildQueue.songs.length === 1) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`▶️ **${track.title}** を再生するよ`)
          .setColor(0x55ff99)
      ]
    });
    await guildQueue.playNext();
  } else {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`➕ **${track.title}** をキューに追加したよ`)
          .setColor(0xaaaaaa)
      ]
    });
  }

  queues.set(interaction.guild.id, guildQueue);
}
