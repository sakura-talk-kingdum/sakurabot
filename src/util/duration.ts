/**
 * The longest timeout Discord accepts (28 days)
 */
export const DISCORD_TIMEOUT_MAX_MS = 28 * 24 * 60 * 60 * 1_000;

const UNIT_MS = {
	w: 604_800_000,
	d: 86_400_000,
	h: 3_600_000,
	m: 60_000,
	s: 1_000,
} as const;

export type ParsedDuration = {
	/**
	 * The duration that can be applied right now (capped to Discord's limit)
	 */
	cappedMs: number;
	/**
	 * When the next timeout has to be re-applied, if the duration exceeds the limit
	 */
	nextApplyAt: string | null;
	/**
	 * The ISO timestamp the timeout should end at
	 */
	targetUntil: string | null;
	/**
	 * The full requested duration
	 */
	totalMs: number;
	/**
	 * Whether `max` was part of the input
	 */
	usedMax: boolean;
};

/**
 * Parses strings such as `1w 2d`, `10m`, `max` or `2026-12-31` into a duration.
 *
 * @param input - The string to parse
 */
export function parseDurationDetailed(input: string): ParsedDuration {
	const regex = /(\d{4}-\d{2}-\d{2})|\b(max)\b|(\d+)\s*(w|d|h|m|s)/gi;
	let totalMs = 0;
	let usedMax = false;

	for (const match of input.matchAll(regex)) {
		const [, date, max, amount, unit] = match;

		if (date) {
			// Dates are interpreted at 00:00 in JST
			const diff = new Date(`${date}T00:00:00+09:00`).getTime() - Date.now();
			if (diff > 0) {
				totalMs += diff;
			}

			continue;
		}

		if (max) {
			totalMs += DISCORD_TIMEOUT_MAX_MS;
			usedMax = true;
			continue;
		}

		if (amount && unit) {
			totalMs += Number(amount) * UNIT_MS[unit.toLowerCase() as keyof typeof UNIT_MS];
		}
	}

	const now = Date.now();

	return {
		totalMs,
		cappedMs: Math.min(totalMs, DISCORD_TIMEOUT_MAX_MS),
		usedMax,
		targetUntil: totalMs > 0 ? new Date(now + totalMs).toISOString() : null,
		nextApplyAt:
			totalMs > DISCORD_TIMEOUT_MAX_MS && !usedMax ? new Date(now + DISCORD_TIMEOUT_MAX_MS).toISOString() : null,
	};
}

/**
 * Formats milliseconds as `1日 2時間 3分 4秒`.
 *
 * @param ms - The duration to format
 */
export function formatDurationMs(ms: number): string {
	if (ms <= 0) {
		return '0秒';
	}

	const totalSec = Math.floor(ms / 1_000);
	const day = Math.floor(totalSec / 86_400);
	const hour = Math.floor((totalSec % 86_400) / 3_600);
	const min = Math.floor((totalSec % 3_600) / 60);
	const sec = totalSec % 60;

	return [day ? `${day}日` : null, hour ? `${hour}時間` : null, min ? `${min}分` : null, sec ? `${sec}秒` : null]
		.filter(Boolean)
		.join(' ');
}
