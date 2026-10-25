import { ApplicationCommandOptionType, EmbedBuilder, MessageFlags } from 'discord.js';
import { fetchRanking } from '../../util/accounts.js';
import type { Command } from '../index.js';

const PER_PAGE = 10;

export default {
	data: {
		name: 'top',
		description: 'XPランキングを表示します。',
		options: [
			{
				type: ApplicationCommandOptionType.String,
				name: 'type',
				description: 'ランキングを表示したい場合は種類を選択してください',
				choices: [
					{ name: '💬 テキストランキング', value: 'text' },
					{ name: '🎙️ ボイスランキング', value: 'voice' },
				],
			},
			{
				type: ApplicationCommandOptionType.Integer,
				name: 'range',
				description: 'ランキングのページ番号 (1ページごとに10位ずつ表示)',
				min_value: 1,
			},
		],
	},
	async execute(interaction) {
		const type = interaction.options.getString('type') === 'voice' ? 'voice' : 'text';
		const page = Math.max(interaction.options.getInteger('range') ?? 1, 1);
		const offset = (page - 1) * PER_PAGE;

		const ranking = await fetchRanking(type, offset, PER_PAGE);
		if (ranking.length === 0) {
			await interaction.reply({
				content: `❌ 第 ${page} ページのランキングデータはありません。`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const description = ranking
			.map((row, index) => {
				const xp = type === 'text' ? row.text_xp : row.voice_xp;
				const level = type === 'text' ? row.text_level : row.voice_level;
				return `**${offset + index + 1}位** | <@${row.user_id}>\n┗ Lv.${level} (XP: ${xp})`;
			})
			.join('\n\n');

		const embed = new EmbedBuilder()
			.setTitle(`🏆 ${type === 'text' ? 'テキスト' : 'ボイス'} XPランキング`)
			.setDescription(description)
			.setColor(type === 'text' ? 0x34_98_db : 0x2e_cc_71)
			.setFooter({ text: `ページ: ${page} (${offset + 1}位 ～ ${offset + ranking.length}位)` })
			.setTimestamp();

		await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
	},
} satisfies Command;
