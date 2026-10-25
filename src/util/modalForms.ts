import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js';
import type { ButtonInteraction, InteractionReplyOptions, ModalSubmitInteraction } from 'discord.js';
import { query } from './db.js';

export type ModalField = {
	name: string;
	type: 'PARA' | 'SHORT';
};

export type ModalForm = {
	embed_description: string;
	embed_title: string;
	fields: ModalField[];
	id: string;
	modal_title: string;
};

export type ModalResponse = {
	modal_id: string;
	user_id: string;
	username: string;
	values: Record<string, string>;
};

const PER_PAGE = 20;
const CELL_LIMIT = 200;

/**
 * Fetches a modal form definition.
 *
 * @param id - The custom id of the form
 */
export async function fetchModalForm(id: string): Promise<ModalForm | null> {
	const [form] = await query<ModalForm>('SELECT * FROM modals WHERE id = $1', [id]);
	return form ?? null;
}

/**
 * Fetches all the responses to a modal form.
 *
 * @param id - The custom id of the form
 */
export async function fetchModalResponses(id: string): Promise<ModalResponse[]> {
	return query<ModalResponse>('SELECT * FROM modal_responses WHERE modal_id = $1', [id]);
}

/**
 * Stores a modal form definition.
 *
 * @param form - The form to store
 * @returns Whether the form was stored, `false` if the id is already taken
 */
export async function insertModalForm(form: ModalForm): Promise<boolean> {
	const rows = await query(
		`INSERT INTO modals (id, embed_title, embed_description, modal_title, fields)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (id) DO NOTHING
		RETURNING id`,
		[form.id, form.embed_title, form.embed_description, form.modal_title, JSON.stringify(form.fields)],
	);
	return rows.length === 1;
}

function cell(value: string): string {
	return value.length > CELL_LIMIT ? `${value.slice(0, CELL_LIMIT - 1)}…` : value;
}

/**
 * Builds one page of the responses table.
 *
 * @param form - The form the responses belong to
 * @param responses - All the responses
 * @param page - The zero based page
 */
export function buildResponsesPage(form: ModalForm, responses: ModalResponse[], page: number) {
	const start = page * PER_PAGE;

	const embed = new EmbedBuilder()
		.setTitle(form.modal_title)
		.setDescription(['ユーザー名', ...form.fields.map((field) => field.name)].join(' | '))
		.setFooter({ text: `${page + 1} / ${Math.max(Math.ceil(responses.length / PER_PAGE), 1)} ページ` });

	for (const response of responses.slice(start, start + PER_PAGE)) {
		embed.addFields({
			name: '\u200B',
			value: cell([response.username, ...form.fields.map((field) => response.values[field.name] ?? '-')].join(' | ')),
		});
	}

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`modal_page:${form.id}:${page - 1}`)
			.setLabel('◀')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === 0),
		new ButtonBuilder()
			.setCustomId(`modal_page:${form.id}:${page + 1}`)
			.setLabel('▶')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(start + PER_PAGE >= responses.length),
	);

	return { embeds: [embed], components: [row] };
}

/**
 * Builds the CSV of all the responses.
 *
 * @param form - The form the responses belong to
 * @param responses - All the responses
 */
export function buildResponsesCsv(form: ModalForm, responses: ModalResponse[]): string {
	const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
	const header = ['username', ...form.fields.map((field) => field.name)].map(escape).join(',');
	const rows = responses.map((response) =>
		[response.username, ...form.fields.map((field) => response.values[field.name] ?? '')].map(escape).join(','),
	);

	return [header, ...rows].join('\n');
}

const notFound = {
	content: 'フォームが見つかりませんでした',
	flags: MessageFlags.Ephemeral,
} as const satisfies InteractionReplyOptions;

/**
 * Handles the buttons of the modal forms (open the form, change the page of the responses).
 *
 * @param interaction - The interaction of the button
 */
export async function handleModalButton(interaction: ButtonInteraction): Promise<void> {
	const [type, id, page] = interaction.customId.split(':');
	if (!id) {
		return;
	}

	const form = await fetchModalForm(id);
	if (!form) {
		await interaction.reply(notFound);
		return;
	}

	if (type === 'modal_open') {
		const modal = new ModalBuilder().setCustomId(`modal_submit:${id}`).setTitle(form.modal_title);

		for (const [index, field] of form.fields.entries()) {
			modal.addComponents(
				new ActionRowBuilder<TextInputBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId(`field_${index}`)
						.setLabel(field.name.slice(0, 45))
						.setStyle(field.type === 'SHORT' ? TextInputStyle.Short : TextInputStyle.Paragraph),
				),
			);
		}

		await interaction.showModal(modal);
		return;
	}

	if (type === 'modal_page') {
		const responses = await fetchModalResponses(id);
		await interaction.update(buildResponsesPage(form, responses, Math.max(Number(page) || 0, 0)));
	}
}

/**
 * Handles the submission of a modal form.
 *
 * @param interaction - The interaction of the submission
 */
export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
	const id = interaction.customId.split(':')[1];
	if (!id) {
		return;
	}

	const form = await fetchModalForm(id);
	if (!form) {
		await interaction.reply(notFound);
		return;
	}

	const values: Record<string, string> = {};
	for (const [index, field] of form.fields.entries()) {
		values[field.name] = interaction.fields.getTextInputValue(`field_${index}`);
	}

	await query('INSERT INTO modal_responses (modal_id, user_id, username, "values") VALUES ($1, $2, $3, $4)', [
		id,
		interaction.user.id,
		interaction.user.username,
		JSON.stringify(values),
	]);

	await interaction.reply({ content: '送信完了！', flags: MessageFlags.Ephemeral });
}
