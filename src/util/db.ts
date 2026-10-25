import pg from 'pg';
import { env } from './env.js';

/**
 * The shared connection pool. Without `DATABASE_URL`, the standard `PG*` environment variables are used.
 */
export const pool = new pg.Pool(env.DATABASE_URL ? { connectionString: env.DATABASE_URL } : {});

/**
 * Runs a query and returns the resulting rows.
 *
 * @param text - The SQL to run
 * @param values - The values for the placeholders
 */
export async function query<Row extends pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<Row[]> {
	const result = await pool.query<Row>(text, values);
	return result.rows;
}

/**
 * Escapes the wildcards of a string so it can be used inside an `ILIKE` pattern.
 *
 * @param value - The string to escape
 */
export function escapeLike(value: string): string {
	return value.replaceAll(/[\\%_]/g, (char) => `\\${char}`);
}
