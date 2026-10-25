import { ApplicationCommandOptionType, AttachmentBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { buildResponsesCsv, buildResponsesPage, fetchModalForm, fetchModalResponses } from '../../util/modalForms.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'modalview',
		description: 'モーダル集計を見る / CSV出力',
		default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
		options: [
			{
				type: ApplicationCommandOptionType.String,
				name: 'id',
				description: 'モーダルのIDを指定してください',
				required: true,
			},
			{ type: ApplicationCommandOptionType.Boolean, name: 'csv', description: 'CSV出力する場合は true' },
		],
	},
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
			await interaction.reply({ content: '権限がありません', flags: MessageFlags.Ephemeral });
			return;
		}

		const id = interaction.options.getString('id', true);
		const form = await fetchModalForm(id);
		if (!form) {
			await interaction.reply({ content: `❌ ID \`${id}\` のフォームが見つかりません`, flags: MessageFlags.Ephemeral });
			return;
		}

		const responses = await fetchModalResponses(id);

		if (interaction.options.getBoolean('csv')) {
			await interaction.reply({
				// The BOM makes Excel read the file as UTF-8
				files: [
					new AttachmentBuilder(Buffer.from(`\uFEFF${buildResponsesCsv(form, responses)}`), { name: `${id}.csv` }),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.reply({ ...buildResponsesPage(form, responses, 0), flags: MessageFlags.Ephemeral });
	},
} satisfies Command;
