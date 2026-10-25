import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
	PermissionFlagsBits,
} from 'discord.js';
import type { Command } from '../index.js';

const AUTH_URL = 'https://bot.sakurahp.f5.si/auth';

export default {
	data: {
		name: 'auth',
		description: '認証用リンクを表示します',
		default_member_permissions: PermissionFlagsBits.Administrator.toString(),
	},
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: '❌ 管理者のみ使用可能です', flags: MessageFlags.Ephemeral });
			return;
		}

		const embed = new EmbedBuilder()
			.setTitle('🔐 認証パネル')
			.setDescription('以下のボタンから認証を進めてください。')
			.setColor(0x58_65_f2);
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setLabel('認証サイトへ').setStyle(ButtonStyle.Link).setURL(AUTH_URL),
		);

		await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
	},
} satisfies Command;
