import { query } from './db.js';

export type PinnedMessage = {
	author_name: string | null;
	channel_id: string;
	content: string;
	message_id: string;
};

/**
 * Fetches the pinned message of a channel.
 *
 * @param channelId - The id of the channel
 */
export async function getPinned(channelId: string): Promise<PinnedMessage | null> {
	const [row] = await query<PinnedMessage>('SELECT * FROM pinned_messages WHERE channel_id = $1 LIMIT 1', [channelId]);
	return row ?? null;
}

/**
 * Stores the pinned message of a channel.
 *
 * @param pin - The pinned message to store
 */
export async function upsertPinned(pin: PinnedMessage): Promise<void> {
	await query(
		`INSERT INTO pinned_messages (channel_id, message_id, content, author_name, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (channel_id) DO UPDATE SET
			message_id = EXCLUDED.message_id,
			content = EXCLUDED.content,
			author_name = EXCLUDED.author_name,
			updated_at = EXCLUDED.updated_at`,
		[pin.channel_id, pin.message_id, pin.content, pin.author_name, new Date().toISOString()],
	);
}

/**
 * Removes the pinned message of a channel.
 *
 * @param channelId - The id of the channel
 */
export async function deletePinned(channelId: string): Promise<void> {
	await query('DELETE FROM pinned_messages WHERE channel_id = $1', [channelId]);
}
