import { URL } from 'node:url';
import { Events, MessageFlags } from 'discord.js';
import type { Interaction } from 'discord.js';
import { loadCommands } from '../util/loaders.js';
import { handleModalButton, handleModalSubmit } from '../util/modalForms.js';
import type { Event } from './index.js';

const commands = await loadCommands(new URL('../commands/', import.meta.url));

async function handle(interaction: Interaction): Promise<void> {
	if (interaction.isChatInputCommand()) {
		const command = commands.get(interaction.commandName);

		if (!command) {
			throw new Error(`Command '${interaction.commandName}' not found.`);
		}

		await command.execute(interaction);
	} else if (interaction.isButton() && interaction.customId.startsWith('modal_')) {
		await handleModalButton(interaction);
	} else if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_submit:')) {
		await handleModalSubmit(interaction);
	}
}

export default {
	name: Events.InteractionCreate,
	async execute(interaction) {
		try {
			await handle(interaction);
		} catch (error) {
			console.error(`Error handling the interaction:`, error);

			// Tell the user instead of letting the interaction time out
			if (interaction.isRepliable()) {
				const content = '❌ エラーが発生しました。';
				await (
					interaction.deferred || interaction.replied
						? interaction.followUp({ content, flags: MessageFlags.Ephemeral })
						: interaction.reply({ content, flags: MessageFlags.Ephemeral })
				).catch(() => null);
			}
		}
	},
} satisfies Event<Events.InteractionCreate>;
