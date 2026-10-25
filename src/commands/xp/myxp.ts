import { calculateLevel, fetchAccount } from '../../util/accounts.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'myxp',
		description: '自分のXPとレベルを表示します',
	},
	async execute(interaction) {
		const account = await fetchAccount(interaction.user.id);

		if (!account) {
			await interaction.reply('まだアカウントがないみたいだよ');
			return;
		}

		await interaction.reply(
			[
				`🌱 **${interaction.user.username} のステータス**`,
				`📝 Text XP: **${account.text_xp}** (Lv.${account.text_level})`,
				`🎤 Voice XP: **${account.voice_xp}** (Lv.${account.voice_level})`,
				`🌟 合計レベル: **${calculateLevel(account.text_xp + account.voice_xp)}**`,
			].join('\n'),
		);
	},
} satisfies Command;
