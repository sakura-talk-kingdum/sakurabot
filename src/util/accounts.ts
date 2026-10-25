import { pool, query } from './db.js';

export type Account = {
	last_voice_xp_at: Date | null;
	text_level: number;
	text_xp: number;
	user_id: string;
	voice_level: number;
	voice_xp: number;
};

export type ExperienceType = 'text' | 'voice';
export type Operation = 'add' | 'remove' | 'set';

const MAX_LEVEL = 100;

const COLUMNS = {
	text: { level: 'text_level', xp: 'text_xp' },
	voice: { level: 'voice_level', xp: 'voice_xp' },
} as const;

/**
 * Calculates the level from an amount of XP.
 *
 * @param totalXp - The XP to calculate the level for
 */
export function calculateLevel(totalXp: number): number {
	return Math.min(Math.floor(totalXp / 10), MAX_LEVEL);
}

function randomExperience(type: ExperienceType): number {
	return type === 'text' ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 8) + 2;
}

/**
 * Fetches the account of a user.
 *
 * @param userId - The id of the user
 */
export async function fetchAccount(userId: string): Promise<Account | null> {
	const [account] = await query<Account>('SELECT * FROM accounts WHERE user_id = $1', [userId]);
	return account ?? null;
}

/**
 * Creates an account for a user if there is none yet.
 *
 * @param userId - The id of the user
 * @returns Whether a new account was created
 */
export async function createAccount(userId: string): Promise<boolean> {
	const result = await pool.query(
		`INSERT INTO accounts (user_id, text_xp, text_level, voice_xp, voice_level, last_voice_xp_at)
		VALUES ($1, 0, 0, 0, 0, NULL)
		ON CONFLICT (user_id) DO NOTHING`,
		[userId],
	);
	return result.rowCount === 1;
}

/**
 * Deletes the account of a user.
 *
 * @param userId - The id of the user
 * @returns Whether an account was deleted
 */
export async function deleteAccount(userId: string): Promise<boolean> {
	const result = await pool.query('DELETE FROM accounts WHERE user_id = $1', [userId]);
	return result.rowCount === 1;
}

/**
 * Moves the account data from one user to another, replacing the data of the target.
 *
 * @param oldId - The id of the user to move from
 * @param newId - The id of the user to move to
 * @returns Whether the source account existed
 */
export async function transferAccount(oldId: string, newId: string): Promise<boolean> {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		const moved = await client.query(
			`INSERT INTO accounts (user_id, text_xp, text_level, voice_xp, voice_level, last_voice_xp_at)
			SELECT $2, text_xp, text_level, voice_xp, voice_level, last_voice_xp_at FROM accounts WHERE user_id = $1
			ON CONFLICT (user_id) DO UPDATE SET
				text_xp = EXCLUDED.text_xp,
				text_level = EXCLUDED.text_level,
				voice_xp = EXCLUDED.voice_xp,
				voice_level = EXCLUDED.voice_level,
				last_voice_xp_at = EXCLUDED.last_voice_xp_at`,
			[oldId, newId],
		);

		if (moved.rowCount !== 1) {
			await client.query('ROLLBACK');
			return false;
		}

		if (oldId !== newId) {
			await client.query('DELETE FROM accounts WHERE user_id = $1', [oldId]);
		}

		await client.query('COMMIT');
		return true;
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

/**
 * Gives a user a random amount of XP, creating the account when needed.
 *
 * @param userId - The id of the user
 * @param type - The kind of XP to give
 */
export async function addExperience(userId: string, type: ExperienceType): Promise<void> {
	await createAccount(userId);

	const { level, xp } = COLUMNS[type];
	const voiceStamp = type === 'voice' ? ', last_voice_xp_at = NOW()' : '';

	await pool.query(
		`UPDATE accounts SET ${xp} = ${xp} + $2, ${level} = LEAST(FLOOR((${xp} + $2) / 10), ${MAX_LEVEL})${voiceStamp}
		WHERE user_id = $1`,
		[userId, randomExperience(type)],
	);
}

function applyOperation(current: number, operation: Operation, value: number): number {
	const next = operation === 'add' ? current + value : operation === 'remove' ? current - value : value;
	return Math.max(next, 0);
}

/**
 * Changes the XP of a user. The level follows the XP.
 *
 * @param userId - The id of the user
 * @param type - The kind of XP to change
 * @param operation - How to apply the value
 * @param value - The value to apply
 * @returns Whether the account exists
 */
export async function modifyExperience(
	userId: string,
	type: ExperienceType,
	operation: Operation,
	value: number,
): Promise<boolean> {
	const account = await fetchAccount(userId);
	if (!account) {
		return false;
	}

	const { level, xp } = COLUMNS[type];
	const nextXp = applyOperation(account[xp], operation, value);

	await pool.query(`UPDATE accounts SET ${xp} = $2, ${level} = $3 WHERE user_id = $1`, [
		userId,
		nextXp,
		calculateLevel(nextXp),
	]);
	return true;
}

/**
 * Changes the level of a user directly.
 *
 * @param userId - The id of the user
 * @param type - The kind of level to change
 * @param operation - How to apply the value
 * @param value - The value to apply
 * @returns Whether the account exists
 */
export async function modifyLevel(
	userId: string,
	type: ExperienceType,
	operation: Operation,
	value: number,
): Promise<boolean> {
	const account = await fetchAccount(userId);
	if (!account) {
		return false;
	}

	const { level } = COLUMNS[type];
	const nextLevel = Math.min(applyOperation(account[level], operation, value), MAX_LEVEL);

	await pool.query(`UPDATE accounts SET ${level} = $2 WHERE user_id = $1`, [userId, nextLevel]);
	return true;
}

/**
 * Counts how many accounts have more XP than the given amount.
 *
 * @param type - The kind of XP to compare
 * @param xpAmount - The amount of XP
 */
export async function countAbove(type: ExperienceType, xpAmount: number): Promise<number> {
	const { xp } = COLUMNS[type];
	const [row] = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM accounts WHERE ${xp} > $1`, [xpAmount]);
	return Number(row?.count ?? 0);
}

/**
 * Fetches a page of the ranking.
 *
 * @param type - The kind of XP to rank by
 * @param offset - How many accounts to skip
 * @param limit - How many accounts to fetch
 */
export async function fetchRanking(type: ExperienceType, offset: number, limit: number): Promise<Account[]> {
	const { xp } = COLUMNS[type];
	return query<Account>(`SELECT * FROM accounts ORDER BY ${xp} DESC, user_id ASC OFFSET $1 LIMIT $2`, [offset, limit]);
}
