import type { Client } from 'discord.js';
import { ActivityType } from 'discord.js';
import cron from 'node-cron';
import { BUMP_ROLE_ID } from './config.js';
import { query } from './db.js';
import { findBirthdays } from './birthdays.js';
import { env } from './env.js';
import { processDueTimeoutContinuations } from './moderation.js';

const JST = 'Asia/Tokyo';

type Odai = { id: number; text: string; used: boolean };
type BumpSetting = { bot_id: string; wait_minutes: number };
type BumpLog = { channel_id: string; command_id: string; detected_at: Date; id: number };

async function sendDailyOdai(client: Client): Promise<void> {
	if (!env.DISCORD_CHAT_CHANNEL_ID) {
		return;
	}

	let unused = await query<Odai>('SELECT * FROM odai WHERE used = FALSE');
	if (unused.length === 0) {
		await query('UPDATE odai SET used = FALSE');
		unused = await query<Odai>('SELECT * FROM odai');
	}

	const pick = unused[Math.floor(Math.random() * unused.length)];
	if (!pick) {
		console.warn('There are no odai to send.');
		return;
	}

	const channel = await client.channels.fetch(env.DISCORD_CHAT_CHANNEL_ID);
	if (!channel?.isSendable()) {
		return;
	}

	await channel.send({
		embeds: [
			{
				title: '今日のお題',
				description: pick.text,
				color: 0x00_bf_ff,
				footer: { text: `ID: ${pick.id} | 残り ${unused.length - 1} 件` },
				timestamp: new Date().toISOString(),
			},
		],
	});
	await query('UPDATE odai SET used = TRUE WHERE id = $1', [pick.id]);
}

async function remindBumps(client: Client): Promise<void> {
	const settings = await query<BumpSetting>('SELECT * FROM bump_settings');

	for (const setting of settings) {
		const logs = await query<BumpLog>('SELECT * FROM bump_logs WHERE bot_id = $1', [setting.bot_id]);

		for (const log of logs) {
			const minutes = (Date.now() - new Date(log.detected_at).getTime()) / 60_000;
			if (minutes < setting.wait_minutes) {
				continue;
			}

			const channel = await client.channels.fetch(log.channel_id).catch(() => null);
			if (channel?.isSendable()) {
				await channel
					.send({
						content: `<@&${BUMP_ROLE_ID}> 時間だよ！⏰\n</up:${log.command_id}> を実行してね！`,
						embeds: [
							{
								title: 'bump リマインド',
								description: `検出から${setting.wait_minutes}分経過したよ！`,
								timestamp: new Date().toISOString(),
							},
						],
					})
					.catch((error: unknown) => {
						console.error('Failed to send the bump reminder:', error);
					});
			}

			await query('DELETE FROM bump_logs WHERE id = $1', [log.id]);
		}
	}
}

async function fetchAnniversary(): Promise<string> {
	const now = new Date(Date.now() + 9 * 60 * 60 * 1_000);
	const mmdd = `${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;

	try {
		const response = await fetch(`https://api.whatistoday.cyou/index.cgi/v3/anniv/${mmdd}`);
		const data = (await response.json()) as { anniv1?: string };
		return data.anniv1 ? `今日は${data.anniv1}` : '今日は特別な記念日はありません';
	} catch (error) {
		console.error('Failed to fetch the anniversary:', error);
		return 'データ取得エラー';
	}
}

async function fetchBirthdayInfo(client: Client): Promise<string> {
	const now = new Date(Date.now() + 9 * 60 * 60 * 1_000);
	const names: string[] = [];

	for (const entry of findBirthdays(now.getUTCMonth() + 1, now.getUTCDate())) {
		if (!entry.id) {
			names.push(entry.name);
			continue;
		}

		let name = `ID:${entry.id}`;
		for (const guild of client.guilds.cache.values()) {
			const member = await guild.members.fetch(entry.id).catch(() => null);
			if (member) {
				name = member.displayName;
				break;
			}
		}

		names.push(name);
	}

	return names.length > 0 ? `🎂 ${names.join(', ')}` : '';
}

/**
 * Starts the recurring jobs: daily odai, timeout continuations, bump reminders and the rotating presence.
 *
 * @param client - The ready client
 */
export async function startScheduler(client: Client<true>): Promise<void> {
	let anniversary = await fetchAnniversary();
	let birthdays = await fetchBirthdayInfo(client);

	cron.schedule(
		'0 0 5 * * *',
		() => {
			sendDailyOdai(client).catch((error: unknown) => {
				console.error('Failed to send the daily odai:', error);
			});
		},
		{ timezone: JST },
	);

	cron.schedule(
		'0 0 * * *',
		() => {
			void (async () => {
				anniversary = await fetchAnniversary();
				birthdays = await fetchBirthdayInfo(client);
			})();
		},
		{ timezone: JST },
	);

	setInterval(() => {
		processDueTimeoutContinuations(client.guilds).catch((error: unknown) => {
			console.error('Timeout continuation interval failed:', error);
		});
	}, 30_000);

	setInterval(() => {
		remindBumps(client).catch((error: unknown) => {
			console.error('Bump reminder interval failed:', error);
		});
	}, 10_000);

	let showPing = true;
	setInterval(() => {
		const name = showPing ? `Ping: ${Math.round(client.ws.ping)}ms` : `${anniversary} ${birthdays}`.trim();
		client.user.setPresence({ activities: [{ name, type: ActivityType.Playing }], status: 'online' });
		showPing = !showPing;
	}, 5_000);

	await processDueTimeoutContinuations(client.guilds);
}
