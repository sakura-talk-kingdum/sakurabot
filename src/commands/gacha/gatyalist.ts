import { EmbedBuilder, MessageFlags } from 'discord.js';
import { gachaThreads } from '../../util/gacha.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'gatyalist',
		description: 'ガチャ一覧を表示します',
	},
	async execute(interaction) {
		if (gachaThreads.length === 0) {
			await interaction.reply({ content: '❌ ガチャデータが読み込まれていません', flags: MessageFlags.Ephemeral });
			return;
		}

		const embeds = gachaThreads.map((thread) =>
			new EmbedBuilder()
				.setTitle(thread.title)
				.setDescription(
					thread.messages
						.map((message) => (message.probability ? `${message.text} [${message.probability}]` : message.text))
						.join('\n')
						.slice(0, 4_000) || 'メッセージなし',
				)
				.setFooter({ text: `Reply Channel: ${thread.replyChannel ?? '未設定'}` })
				.setColor(0xff_d7_00)
				.setTimestamp(),
		);

		// A message holds up to 10 embeds, the rest goes into follow ups
		for (let index = 0; index < embeds.length; index += 10) {
			const payload = { embeds: embeds.slice(index, index + 10), flags: MessageFlags.Ephemeral } as const;
			await (index === 0 ? interaction.reply(payload) : interaction.followUp(payload));
		}
	},
} satisfies Command;
