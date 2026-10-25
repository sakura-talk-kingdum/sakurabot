import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { loadGachaThreads } from '../../util/gacha.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'gatyareload',
		description: 'ガチャ設定を再読み込みします',
		default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
	},
	async execute(interaction) {
		await interaction.deferReply();
		await loadGachaThreads(interaction.client);

		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle('ガチャ設定再読み込み')
					.setColor(0x4d_d0_e1)
					.setDescription('設定の再読み込みが完了しました')
					.setTimestamp(),
			],
		});
	},
} satisfies Command;
