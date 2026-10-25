import { queues } from '../../util/music.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'playlist',
		description: '現在の再生キューを表示します',
	},
	async execute(interaction) {
		const queue = interaction.guildId ? queues.get(interaction.guildId) : undefined;
		if (!queue || queue.songs.length === 0) {
			await interaction.reply('📭 再生中のプレイリストは空っぽ！');
			return;
		}

		const list = queue.songs.map((song, index) => `${index === 0 ? '▶️' : `${index}.`} ${song.title}`).join('\n');
		await interaction.reply(`🎵 **再生キュー:**\n${list}`.slice(0, 2_000));
	},
} satisfies Command;
