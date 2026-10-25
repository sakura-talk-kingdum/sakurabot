import { stopQueue } from '../../util/music.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'stop',
		description: '再生を停止してボイスチャンネルから退出します',
	},
	async execute(interaction) {
		if (!interaction.guildId || !stopQueue(interaction.guildId)) {
			await interaction.reply('⚠️ 何も再生してないよ！');
			return;
		}

		await interaction.reply('🛑 再生を停止して退出したよ！');
	},
} satisfies Command;
