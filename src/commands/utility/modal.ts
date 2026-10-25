import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
	PermissionFlagsBits,
} from 'discord.js';
import type { APIApplicationCommandOption } from 'discord.js';
import { insertModalForm } from '../../util/modalForms.js';
import type { ModalField } from '../../util/modalForms.js';
import type { Command } from '../index.js';

const typeChoices = [
	{ name: '短文', value: 'SHORT' },
	{ name: '長文', value: 'PARA' },
];

const fieldOptions = [1, 2, 3, 4, 5].flatMap((index): APIApplicationCommandOption[] => [
	{
		type: ApplicationCommandOptionType.String,
		name: `name${index}`,
		description: `項目${index}の名前`,
		required: index === 1,
		max_length: 45,
	},
	{
		type: ApplicationCommandOptionType.String,
		name: `type${index}`,
		description: `項目${index}の形式`,
		required: index === 1,
		choices: typeChoices,
	},
]);

export default {
	data: {
		name: 'modal',
		description: 'モーダル版投票を作成',
		default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
		options: [
			{ type: ApplicationCommandOptionType.String, name: 'title', description: 'タイトル', required: true },
			{ type: ApplicationCommandOptionType.String, name: 'description', description: '説明文', required: true },
			{
				type: ApplicationCommandOptionType.String,
				name: 'modaltitle',
				description: 'モーダルのタイトル',
				required: true,
				max_length: 45,
			},
			{
				type: ApplicationCommandOptionType.String,
				name: 'id',
				description: 'カスタムID',
				required: true,
				max_length: 50,
			},
			...fieldOptions,
		],
	},
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
			await interaction.reply({ content: '権限がありません', flags: MessageFlags.Ephemeral });
			return;
		}

		const id = interaction.options.getString('id', true);
		const title = interaction.options.getString('title', true);
		const description = interaction.options.getString('description', true);

		const fields: ModalField[] = [];
		for (let index = 1; index <= 5; index++) {
			const name = interaction.options.getString(`name${index}`);
			const type = interaction.options.getString(`type${index}`);
			if (name && type) {
				fields.push({ name, type: type === 'SHORT' ? 'SHORT' : 'PARA' });
			}
		}

		const stored = await insertModalForm({
			id,
			embed_title: title,
			embed_description: description,
			modal_title: interaction.options.getString('modaltitle', true),
			fields,
		});

		if (!stored) {
			await interaction.reply({ content: `❌ ID \`${id}\` はすでに使われています`, flags: MessageFlags.Ephemeral });
			return;
		}

		await interaction.reply({
			embeds: [new EmbedBuilder().setTitle(title).setDescription(description)],
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId(`modal_open:${id}`).setLabel('回答する').setStyle(ButtonStyle.Primary),
				),
			],
		});
	},
} satisfies Command;
