import { ApplicationCommandOptionType, EmbedBuilder, MessageFlags } from 'discord.js';
import { ensureQueue, queues, resolveTrack, startPlayback } from '../../util/music.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'play',
		description: 'YouTube の音声を再生キューに追加します',
		options: [
			{
				type: ApplicationCommandOptionType.String,
				name: 'url',
				description: 'YouTube URL または検索ワード',
				required: true,
			},
		],
	},
	async execute(interaction) {
		if (!interaction.inCachedGuild()) {
			await interaction.reply({ content: 'サーバー内でのみ実行できます', flags: MessageFlags.Ephemeral });
			return;
		}

		const channel = interaction.member.voice.channel;
		if (!channel) {
			await interaction.reply({ content: '🔊 先にボイスチャンネルに参加してね', flags: MessageFlags.Ephemeral });
			return;
		}

		const current = queues.get(interaction.guild.id);
		if (current && current.connection.joinConfig.channelId !== channel.id) {
			await interaction.reply({ content: '⚠️ すでに別のボイスチャンネルで再生中だよ', flags: MessageFlags.Ephemeral });
			return;
		}

		await interaction.deferReply();

		const track = await resolveTrack(interaction.options.getString('url', true)).catch((error: unknown) => {
			console.error('Failed to resolve the track:', error);
			return null;
		});
		if (!track) {
			await interaction.editReply('❌ 再生できる動画が見つからなかったよ');
			return;
		}

		const queue = ensureQueue(channel);
		queue.songs.push(track);

		if (queue.songs.length === 1) {
			await interaction.editReply({
				embeds: [new EmbedBuilder().setDescription(`▶️ **${track.title}** を再生するよ`).setColor(0x55_ff_99)],
			});
			await startPlayback(interaction.guild.id);
		} else {
			await interaction.editReply({
				embeds: [new EmbedBuilder().setDescription(`➕ **${track.title}** をキューに追加したよ`).setColor(0xaa_aa_aa)],
			});
		}
	},
} satisfies Command;
