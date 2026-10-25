import { Events } from 'discord.js';
import { loadGachaThreads } from '../util/gacha.js';
import { startScheduler } from '../util/scheduler.js';
import type { Event } from './index.js';

export default {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);

		await loadGachaThreads(client).catch((error: unknown) => {
			console.error('Failed to load the gacha threads:', error);
		});
		await startScheduler(client);
	},
} satisfies Event<Events.ClientReady>;
