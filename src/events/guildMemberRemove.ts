import { AuditLogEvent, Events } from 'discord.js';
import { fetchLatestAuditEntry, logModerationAction } from '../util/moderation.js';
import type { Event } from './index.js';

export default {
	name: Events.GuildMemberRemove,
	async execute(member) {
		const entry = await fetchLatestAuditEntry(member.guild, AuditLogEvent.MemberKick);
		if (entry?.targetId !== member.id) {
			return;
		}

		await logModerationAction({
			guild: member.guild,
			action: 'KICK',
			target: member.user,
			moderator: entry.executor ?? null,
			reason: entry.reason ?? null,
			targetMember: member.partial ? null : member,
		});
	},
} satisfies Event<Events.GuildMemberRemove>;
