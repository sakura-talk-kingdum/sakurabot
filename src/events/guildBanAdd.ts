import { AuditLogEvent, Events } from 'discord.js';
import { fetchLatestAuditEntry, logModerationAction } from '../util/moderation.js';
import type { Event } from './index.js';

export default {
	name: Events.GuildBanAdd,
	async execute(ban) {
		const entry = await fetchLatestAuditEntry(ban.guild, AuditLogEvent.MemberBanAdd);

		await logModerationAction({
			guild: ban.guild,
			action: 'BAN',
			target: ban.user,
			moderator: entry?.executor ?? null,
			reason: entry?.reason ?? ban.reason,
		});
	},
} satisfies Event<Events.GuildBanAdd>;
