import type { AuditLogEvent, Guild, GuildAuditLogsEntry, GuildMember, PartialUser, User } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { DISCORD_TIMEOUT_MAX_MS, formatDurationMs } from './duration.js';
import { query } from './db.js';
import { env } from './env.js';

export type TimeoutContinuation = {
	guild_id: string;
	next_apply_at: Date;
	reason: string | null;
	target_until: Date;
	target_user_id: string;
};

/**
 * Saves a timeout that has to be re-applied once the current one ran out.
 */
export async function scheduleTimeoutContinuation(options: {
	guildId: string;
	nextApplyAt: string;
	reason: string | null;
	targetUntil: string;
	userId: string;
}): Promise<void> {
	try {
		await query(
			`INSERT INTO timeout_continuations (guild_id, target_user_id, reason, target_until, next_apply_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (guild_id, target_user_id) DO UPDATE SET
				reason = EXCLUDED.reason,
				target_until = EXCLUDED.target_until,
				next_apply_at = EXCLUDED.next_apply_at,
				updated_at = EXCLUDED.updated_at`,
			[
				options.guildId,
				options.userId,
				options.reason,
				options.targetUntil,
				options.nextApplyAt,
				new Date().toISOString(),
			],
		);
	} catch (error) {
		console.error('Failed to save the timeout continuation:', error);
	}
}

/**
 * Removes a stored timeout continuation.
 *
 * @param guildId - The id of the guild
 * @param userId - The id of the user
 */
export async function clearTimeoutContinuation(guildId: string, userId: string): Promise<void> {
	try {
		await query('DELETE FROM timeout_continuations WHERE guild_id = $1 AND target_user_id = $2', [guildId, userId]);
	} catch (error) {
		console.error('Failed to delete the timeout continuation:', error);
	}
}

/**
 * Lists the timeout continuations that are due.
 */
export async function listDueTimeoutContinuations(): Promise<TimeoutContinuation[]> {
	return query<TimeoutContinuation>(
		'SELECT * FROM timeout_continuations WHERE next_apply_at <= $1 ORDER BY next_apply_at ASC LIMIT 100',
		[new Date().toISOString()],
	);
}

let processing = false;

/**
 * Re-applies the timeouts that were longer than Discord's limit.
 *
 * @param guilds - Where to look the guilds up
 */
export async function processDueTimeoutContinuations(guilds: Guild['client']['guilds']): Promise<void> {
	if (processing) {
		return;
	}

	processing = true;

	try {
		for (const job of await listDueTimeoutContinuations()) {
			try {
				const guild = await guilds.fetch(job.guild_id);
				const member = await guild.members.fetch(job.target_user_id);

				if (isModerationExempt(member)) {
					await clearTimeoutContinuation(job.guild_id, job.target_user_id);
					continue;
				}

				const remaining = new Date(job.target_until).getTime() - Date.now();
				if (remaining <= 0) {
					await clearTimeoutContinuation(job.guild_id, job.target_user_id);
					continue;
				}

				const applyMs = Math.min(remaining, DISCORD_TIMEOUT_MAX_MS);
				await member.timeout(applyMs, job.reason ?? '長期タイムアウト継続');

				if (remaining > DISCORD_TIMEOUT_MAX_MS) {
					await scheduleTimeoutContinuation({
						guildId: guild.id,
						userId: member.id,
						reason: job.reason,
						targetUntil: new Date(job.target_until).toISOString(),
						nextApplyAt: new Date(Date.now() + applyMs + 1_000).toISOString(),
					});
				} else {
					await clearTimeoutContinuation(job.guild_id, job.target_user_id);
				}
			} catch (error) {
				// 10007 = Unknown Member, the user left the guild
				if (typeof error === 'object' && error !== null && 'code' in error && error.code === 10_007) {
					console.warn(`User ${job.target_user_id} is not in guild ${job.guild_id}, dropping the continuation.`);
					await clearTimeoutContinuation(job.guild_id, job.target_user_id);
				} else {
					console.error('Failed to process the timeout continuation:', error);
				}
			}
		}
	} catch (error) {
		console.error('Failed to process the timeout continuations:', error);
	} finally {
		processing = false;
	}
}

/**
 * Whether the member has the role that is excluded from moderation logs.
 *
 * @param member - The member to check
 */
export function isModerationExempt(member: GuildMember | null | undefined): boolean {
	return Boolean(env.SHIIKU_ROLE_ID && member?.roles.cache.has(env.SHIIKU_ROLE_ID));
}

/**
 * Stores a moderation action and posts it to the moderation log channel.
 */
export async function logModerationAction(options: {
	action: string;
	durationMs?: number | null;
	guild: Guild;
	moderator: PartialUser | User | null;
	reason?: string | null;
	target: User;
	targetMember?: GuildMember | null;
}): Promise<void> {
	const { action, durationMs = null, guild, moderator, reason = null, target } = options;
	const targetMember = options.targetMember ?? (await guild.members.fetch(target.id).catch(() => null));

	if (isModerationExempt(targetMember)) {
		return;
	}

	try {
		await query(
			`INSERT INTO moderation_logs (guild_id, target_user_id, moderator_user_id, action, reason, duration_ms, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[guild.id, target.id, moderator?.id ?? null, action, reason, durationMs, new Date().toISOString()],
		);
	} catch (error) {
		console.error('Failed to store the moderation log:', error);
	}

	if (!env.DISCORD_MOD_LOG_CHANNEL_ID) {
		return;
	}

	try {
		const channel = await guild.channels.fetch(env.DISCORD_MOD_LOG_CHANNEL_ID);
		if (!channel?.isTextBased()) {
			return;
		}

		const embed = new EmbedBuilder()
			.setTitle('🛡️ Moderation Log')
			.setColor(0xed4245)
			.addFields(
				{ name: 'Action', value: action, inline: true },
				{ name: 'Target', value: `${target.tag} (${target.id})`, inline: true },
				{
					name: 'Moderator',
					value: moderator ? `${moderator.tag ?? 'Unknown'} (${moderator.id})` : 'Unknown',
					inline: true,
				},
			)
			.setTimestamp();

		if (durationMs) {
			embed.addFields({ name: 'Duration', value: formatDurationMs(durationMs), inline: true });
		}

		if (reason) {
			embed.addFields({ name: 'Reason', value: reason.slice(0, 1_024) });
		}

		await channel.send({ embeds: [embed] });
	} catch (error) {
		console.error('Failed to send the moderation log:', error);
	}
}

/**
 * Fetches the latest audit log entry of a type, if it is recent.
 *
 * @param guild - The guild to look in
 * @param type - The type of the audit log entry
 */
export async function fetchLatestAuditEntry(guild: Guild, type: AuditLogEvent): Promise<GuildAuditLogsEntry | null> {
	try {
		const logs = await guild.fetchAuditLogs({ type, limit: 1 });
		const entry = logs.entries.first();
		return entry && Date.now() - entry.createdTimestamp < 15_000 ? entry : null;
	} catch {
		return null;
	}
}
