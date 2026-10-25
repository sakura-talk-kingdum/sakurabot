import { AuditLogEvent, Events } from 'discord.js';
import { fetchLatestAuditEntry, logModerationAction } from '../util/moderation.js';
import type { Event } from './index.js';

export default {
	name: Events.GuildMemberUpdate,
	async execute(oldMember, newMember) {
		const before = oldMember.communicationDisabledUntilTimestamp ?? 0;
		const after = newMember.communicationDisabledUntilTimestamp ?? 0;
		if (before === after) {
			return;
		}

		const isTimeout = after > Date.now();
		const entry = await fetchLatestAuditEntry(newMember.guild, AuditLogEvent.MemberUpdate);

		await logModerationAction({
			guild: newMember.guild,
			action: isTimeout ? 'TIMEOUT' : 'UNTIMEOUT',
			target: newMember.user,
			moderator: entry?.executor ?? null,
			reason: entry?.reason ?? null,
			durationMs: isTimeout ? Math.max(after - Date.now(), 0) : null,
			targetMember: newMember,
		});
	},
} satisfies Event<Events.GuildMemberUpdate>;
