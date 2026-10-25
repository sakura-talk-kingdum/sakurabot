import type { Client, Message, ThreadChannel } from 'discord.js';
import { ChannelType, EmbedBuilder } from 'discord.js';
import { GACHA_FORUM_CHANNEL_ID } from './config.js';
import { escapeLike, query } from './db.js';

export type GachaSet = {
	channel_id: string | null;
	enabled: boolean;
	guild_id: string;
	id: string;
	name: string;
	probabilities: Record<string, number | string> | string;
	trigger_word: string | null;
};

export type GachaItem = {
	amount: number | string | null;
	description: string | null;
	display_id: number | null;
	name: string;
	rarity: string;
	set_id: string;
};

export type GachaLog = {
	display_id: number | null;
	rarity: string | null;
};

/**
 * Searches the gacha sets of a guild by name.
 *
 * @param guildId - The id of the guild
 * @param name - Part of the name
 */
export async function searchSets(guildId: string, name: string): Promise<GachaSet[]> {
	return query<GachaSet>(
		`SELECT id, name, trigger_word, enabled FROM gacha_sets
		WHERE guild_id = $1 AND name ILIKE $2 ORDER BY created_at DESC LIMIT 10`,
		[guildId, `%${escapeLike(name)}%`],
	);
}

/**
 * Finds the gacha sets of a guild by id, exact name or trigger word, falling back to a partial name match.
 *
 * @param guildId - The id of the guild
 * @param input - The id, name or trigger word
 */
export async function findSets(guildId: string, input: string): Promise<GachaSet[]> {
	const exact = await query<GachaSet>(
		`SELECT id, name, trigger_word FROM gacha_sets
		WHERE guild_id = $1 AND (id::text = $2 OR name = $2 OR trigger_word = $2) LIMIT 5`,
		[guildId, input],
	);
	if (exact.length > 0) {
		return exact;
	}

	return query<GachaSet>(
		'SELECT id, name, trigger_word FROM gacha_sets WHERE guild_id = $1 AND name ILIKE $2 LIMIT 5',
		[guildId, `%${escapeLike(input)}%`],
	);
}

/**
 * Fetches everything a user pulled from a set.
 *
 * @param guildId - The id of the guild
 * @param setId - The id of the set
 * @param userId - The id of the user
 */
export async function fetchLogs(guildId: string, setId: string, userId: string): Promise<GachaLog[]> {
	return query<GachaLog>(
		'SELECT display_id, rarity FROM gacha_logs WHERE guild_id = $1 AND set_id = $2 AND user_id = $3',
		[guildId, setId, userId],
	);
}

/**
 * Fetches the items of a set by their display ids.
 *
 * @param setId - The id of the set
 * @param displayIds - The display ids to fetch
 */
export async function fetchItemsByDisplayId(setId: string, displayIds: number[]): Promise<GachaItem[]> {
	return query<GachaItem>(
		'SELECT display_id, name, rarity FROM gacha_items WHERE set_id = $1 AND display_id = ANY($2::int[])',
		[setId, displayIds],
	);
}

/**
 * Fetches the enabled sets of a guild.
 *
 * @param guildId - The id of the guild
 */
export async function fetchEnabledSets(guildId: string): Promise<GachaSet[]> {
	return query<GachaSet>('SELECT * FROM gacha_sets WHERE guild_id = $1 AND enabled = TRUE', [guildId]);
}

function pickWeighted<Entry>(entries: Entry[], weight: (entry: Entry) => number): Entry | undefined {
	const total = entries.reduce((sum, entry) => sum + weight(entry), 0);
	let roll = Math.random() * total;

	for (const entry of entries) {
		roll -= weight(entry);
		if (roll <= 0) {
			return entry;
		}
	}

	return entries[0];
}

/**
 * Pulls the gacha of a set and replies with the result.
 *
 * @param message - The message that triggered the gacha
 * @param set - The set to pull from
 */
export async function runGacha(message: Message<true>, set: GachaSet): Promise<void> {
	const items = await query<GachaItem>('SELECT * FROM gacha_items WHERE set_id = $1', [set.id]);
	if (items.length === 0) {
		console.error(`The gacha set ${set.id} has no items.`);
		return;
	}

	const probabilities = (
		typeof set.probabilities === 'string' ? JSON.parse(set.probabilities) : set.probabilities
	) as Record<string, number | string>;
	const rarity = pickWeighted(Object.entries(probabilities), ([, percent]) => Number(percent))?.[0];
	const candidates = items.filter((item) => item.rarity === rarity);
	const hit = pickWeighted(candidates, (item) => Number.parseInt(String(item.amount), 10) || 1);

	if (!hit) {
		console.error(`The gacha set ${set.id} has no item for the rarity ${rarity ?? 'unknown'}.`);
		return;
	}

	try {
		await query('INSERT INTO gacha_logs (guild_id, set_id, user_id, display_id, rarity) VALUES ($1, $2, $3, $4, $5)', [
			message.guild.id,
			set.id,
			message.author.id,
			hit.display_id,
			hit.rarity,
		]);
	} catch (error) {
		console.error('Failed to store the gacha log:', error);
	}

	const description = (hit.description ?? '')
		.replaceAll('[userName]', message.author.username)
		.replaceAll(String.raw`\n`, '\n');
	const imageUrl = /(https?:\/\/\S+?\.(?:jpg|jpeg|png|gif|webp)(?:\?\S*)?)/i.exec(description)?.[0];

	const embed = new EmbedBuilder()
		.setTitle(`🎰 ${set.name}`)
		.setDescription(`**${hit.name}**\n${description}`)
		.addFields({ name: 'レアリティ', value: hit.rarity, inline: true })
		.setColor(0xf1_c4_0f);

	if (imageUrl) {
		embed.setImage(imageUrl);
	}

	await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
}

export type GachaThread = {
	id: string;
	messages: { probability: string; text: string }[];
	replyChannel: string | null;
	title: string;
};

/**
 * The gacha threads of the forum channel, kept in memory.
 */
export const gachaThreads: GachaThread[] = [];

function extractProbability(text: string): { probability: string; text: string } {
	const match = /\[(\d+)]$/.exec(text);
	return match ? { probability: match[1] ?? '', text: text.slice(0, match.index).trim() } : { probability: '', text };
}

async function readThread(thread: ThreadChannel): Promise<GachaThread> {
	const data: GachaThread = {
		id: thread.id,
		title: thread.name,
		replyChannel: /\d+/.exec(thread.parent?.topic ?? '')?.[0] ?? null,
		messages: [],
	};

	let before: string | undefined;
	for (;;) {
		const messages = await thread.messages.fetch(before ? { limit: 100, before } : { limit: 100 });
		if (messages.size === 0) {
			break;
		}

		const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
		for (const message of sorted) {
			data.messages.push(extractProbability(message.content));
		}

		before = messages.last()?.id;
	}

	return data;
}

/**
 * Reloads the gacha threads from the forum channel.
 *
 * @param client - The client to fetch the channel with
 */
export async function loadGachaThreads(client: Client): Promise<void> {
	const channel = await client.channels.fetch(GACHA_FORUM_CHANNEL_ID).catch(() => null);
	if (channel?.type !== ChannelType.GuildForum) {
		console.error('The gacha channel is not a forum channel.');
		return;
	}

	const loaded: GachaThread[] = [];
	const [active, archived] = await Promise.all([
		channel.threads.fetchActive(),
		channel.threads.fetchArchived({ type: 'public' }),
	]);

	for (const thread of [...active.threads.values(), ...archived.threads.values()]) {
		try {
			loaded.push(await readThread(thread));
		} catch (error) {
			console.error(`Failed to read the thread ${thread.id}:`, error);
		}
	}

	gachaThreads.splice(0, gachaThreads.length, ...loaded);
	console.log(`Loaded ${gachaThreads.length} gacha threads.`);
}
