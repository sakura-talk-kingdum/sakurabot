import { ApplicationCommandType, InteractionContextType } from 'discord.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'launch',
		description: 'アプリを起動します',
		type: ApplicationCommandType.PrimaryEntryPoint,
		integration_types: [0, 1],
		contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
	},
	execute() {
		// The entry point command is handled by Discord (it launches the activity), so there is nothing to do.
	},
} satisfies Command;
