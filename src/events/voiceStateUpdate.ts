import { Events } from 'discord.js';
import { addExperience, fetchAccount } from '../util/accounts.js';
import type { Event } from './index.js';

const COOLDOWN_MS = 10 * 60 * 1_000;

export default {
	name: Events.VoiceStateUpdate,
	async execute(oldState, newState) {
		// Only joining a voice channel gives XP
		if (oldState.channelId || !newState.channelId || !newState.member || newState.member.user.bot) {
			return;
		}

		const account = await fetchAccount(newState.member.id);
		if (!account) {
			return;
		}

		const last = account.last_voice_xp_at ? new Date(account.last_voice_xp_at).getTime() : 0;
		if (Date.now() - last < COOLDOWN_MS) {
			return;
		}

		await addExperience(newState.member.id, 'voice');
	},
} satisfies Event<Events.VoiceStateUpdate>;
