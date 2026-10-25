import { ApplicationCommandOptionType, EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { upsertPinned } from '../../util/pins.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'msgpin',
		description: 'チャンネルにメッセージを固定します',
		default_member_permissions: PermissionFlagsBits.Administrator.toString(),
		options: [{ type: ApplicationCommandOptionType.String, name: 'msg', description: '固定する内容', required: true }],
	},
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: '権限がありません', flags: MessageFlags.Ephemeral });
			return;
		}

		const { channel } = interaction;
		if (!channel?.isSendable()) {
			await interaction.reply({ content: 'このチャンネルには固定できません', flags: MessageFlags.Ephemeral });
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const content = interaction.options.getString('msg', true);
		const sent = await channel.send({
			embeds: [
				new EmbedBuilder()
					.setDescription(content)
					.setColor(0x00_ae_86)
					.setFooter({ text: `📌 投稿者: ${interaction.user.tag}` })
					.setTimestamp(),
			],
		});

		await upsertPinned({
			channel_id: channel.id,
			message_id: sent.id,
			content,
			author_name: interaction.user.tag,
		});
		await interaction.editReply('📌 メッセージを固定しました！');
	},
} satisfies Command;
