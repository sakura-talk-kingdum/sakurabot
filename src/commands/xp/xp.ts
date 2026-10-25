import { ApplicationCommandOptionType, EmbedBuilder, MessageFlags } from 'discord.js';
import { countAbove, fetchAccount } from '../../util/accounts.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'xp',
		description: 'XPステータスやランキングを表示します',
		options: [
			{
				type: ApplicationCommandOptionType.User,
				name: 'user',
				description: 'ステータスを見たいユーザーを選択 (未指定なら自分)',
			},
		],
	},
	async execute(interaction) {
		const target = interaction.options.getUser('user') ?? interaction.user;
		const account = await fetchAccount(target.id);

		if (!account) {
			await interaction.reply({
				content: `❌ ${target} のXPデータが見つかりませんでした。`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const [textAbove, voiceAbove] = await Promise.all([
			countAbove('text', account.text_xp),
			countAbove('voice', account.voice_xp),
		]);

		const embed = new EmbedBuilder()
			.setTitle('📊 XPステータス & ランキング')
			.setDescription(`${target} の現在のステータス`)
			.setColor(0x34_98_db)
			.addFields(
				{
					name: '💬 テキスト',
					value: `**順位**: \`${textAbove + 1}位\`\n**Lv.${account.text_level}** (${account.text_xp} XP)`,
					inline: true,
				},
				{
					name: '🎙️ ボイス',
					value: `**順位**: \`${voiceAbove + 1}位\`\n**Lv.${account.voice_level}** (${account.voice_xp} XP)`,
					inline: true,
				},
			)
			.setThumbnail(target.displayAvatarURL({ size: 256 }))
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });
	},
} satisfies Command;
