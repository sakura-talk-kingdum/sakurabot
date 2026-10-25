import { setTimeout as sleep } from 'node:timers/promises';
import { ApplicationCommandOptionType, EmbedBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../index.js';

const REGIONAL_INDICATOR_A = 0x1_f1_e6;
const MAX_CHOICES = 20;

export default {
	data: {
		name: 'poll',
		description: '投票を作成します',
		options: [
			{ type: ApplicationCommandOptionType.String, name: 'title', description: '投票タイトル', required: true },
			{
				type: ApplicationCommandOptionType.String,
				name: 'data',
				description: "例: a_'りんご',b_'みかん'",
				required: true,
			},
		],
	},
	async execute(interaction) {
		const title = interaction.options.getString('title', true);
		const choices: { key: string; text: string }[] = [];

		for (const pair of interaction.options.getString('data', true).split(',')) {
			const match = /^([a-z])_'(.+)'$/i.exec(pair.trim());
			if (match?.[1] && match[2] && !choices.some((choice) => choice.key === match[1]?.toLowerCase())) {
				choices.push({ key: match[1].toLowerCase(), text: match[2] });
			}
		}

		if (choices.length === 0) {
			await interaction.reply({ content: '❌ データ形式が正しくないよ！', flags: MessageFlags.Ephemeral });
			return;
		}

		const usable = choices.slice(0, MAX_CHOICES);
		const embed = new EmbedBuilder()
			.setTitle(title)
			.setDescription(usable.map((choice) => `:regional_indicator_${choice.key}:  ${choice.text}`).join('\n'))
			.setColor(0xff_77_aa);

		const message = await (await interaction.reply({ embeds: [embed], withResponse: true })).resource?.message;

		for (const choice of usable) {
			const emoji = String.fromCodePoint(REGIONAL_INDICATOR_A + choice.key.charCodeAt(0) - 'a'.charCodeAt(0));
			await message?.react(emoji).catch(() => null);
			await sleep(450);
		}
	},
} satisfies Command;
