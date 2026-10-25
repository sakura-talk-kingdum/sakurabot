import { ApplicationCommandOptionType, EmbedBuilder, MessageFlags } from 'discord.js';
import { REPORT_CHANNEL_ID } from '../../util/config.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'report',
		description: 'ユーザーを通報します',
		options: [
			{
				type: ApplicationCommandOptionType.String,
				name: 'userid',
				description: '通報するユーザーID',
				required: true,
			},
			{ type: ApplicationCommandOptionType.String, name: 'reason', description: '通報理由', required: true },
			{ type: ApplicationCommandOptionType.Attachment, name: 'file', description: '証拠画像（任意）' },
		],
	},
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const userId = interaction.options.getString('userid', true);
		const reason = interaction.options.getString('reason', true);
		const file = interaction.options.getAttachment('file');

		const channel = await interaction.client.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
		if (!channel?.isSendable()) {
			await interaction.editReply('❌ 通報チャンネルが見つかりません');
			return;
		}

		const embed = new EmbedBuilder()
			.setTitle('🚨 ユーザー通報')
			.setColor(0xed_42_45)
			.addFields(
				{ name: '通報者', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
				{ name: '対象ユーザー', value: `<@${userId}> (${userId})`, inline: true },
				{ name: '理由', value: reason.slice(0, 1_024) },
			)
			.setTimestamp();

		await channel.send({
			embeds: [embed],
			files: file ? [{ attachment: file.url }] : [],
			allowedMentions: { parse: [] },
		});
		await interaction.editReply('✅ 通報を送信しました！');
	},
} satisfies Command;
