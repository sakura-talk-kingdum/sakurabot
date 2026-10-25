import {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
	VoiceConnectionStatus,
} from '@discordjs/voice';
import { MessageFlags } from 'discord.js';
import { fileURLToPath, URL } from 'node:url';
import { queues } from '../../util/music.js';
import type { Command } from '../index.js';

// dist/commands/music/barusu.js -> assets/barusu.mp3
const AUDIO_PATH = fileURLToPath(new URL('../../../assets/barusu.mp3', import.meta.url));

export default {
	data: {
		name: 'barusu',
		description: '電子計算機損壊等業務妨害に成りうるかもね???',
	},
	async execute(interaction) {
		if (!interaction.inCachedGuild()) {
			await interaction.reply({ content: 'サーバー内でのみ実行できます', flags: MessageFlags.Ephemeral });
			return;
		}

		const channel = interaction.member.voice.channel;
		if (!channel) {
			await interaction.reply({ content: '❌ 先にボイスチャンネル入って', flags: MessageFlags.Ephemeral });
			return;
		}

		if (queues.has(interaction.guild.id)) {
			await interaction.reply({ content: '⚠️ 音楽を再生中だよ', flags: MessageFlags.Ephemeral });
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const connection = joinVoiceChannel({
			channelId: channel.id,
			guildId: interaction.guild.id,
			adapterCreator: interaction.guild.voiceAdapterCreator,
		});

		try {
			await entersState(connection, VoiceConnectionStatus.Ready, 5_000);
		} catch {
			connection.destroy();
			await interaction.editReply('❌ ボイスチャンネルに接続できなかったよ');
			return;
		}

		const player = createAudioPlayer();
		connection.subscribe(player);
		player.play(createAudioResource(AUDIO_PATH));

		player.once(AudioPlayerStatus.Idle, () => connection.destroy());
		player.once('error', (error) => {
			console.error('Audio player error:', error);
			connection.destroy();
		});

		await interaction.editReply('💥 バルス発動');
	},
} satisfies Command;
