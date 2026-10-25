import { queues } from '../../util/music.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'skip',
		description: '再生中の曲をスキップします',
	},
	async execute(interaction) {
		const queue = interaction.guildId ? queues.get(interaction.guildId) : undefined;
		if (!queue || queue.songs.length <= 1) {
			await interaction.reply('⚠️ スキップできる曲がないよ！');
			return;
		}

		queue.player.stop(true);
		await interaction.reply('⏭️ スキップしたよ！');
	},
} satisfies Command;
