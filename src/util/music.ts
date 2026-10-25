import {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
	VoiceConnectionStatus,
} from '@discordjs/voice';
import type { AudioPlayer, VoiceConnection } from '@discordjs/voice';
import type { VoiceBasedChannel } from 'discord.js';
import play from 'play-dl';

export type Track = {
	title: string;
	url: string;
};

export type GuildQueue = {
	connection: VoiceConnection;
	player: AudioPlayer;
	songs: Track[];
};

/**
 * The playback queues by guild id.
 */
export const queues = new Map<string, GuildQueue>();

/**
 * Resolves a YouTube URL or a search term to a track.
 *
 * @param input - The URL or search term
 */
export async function resolveTrack(input: string): Promise<Track | null> {
	if (play.yt_validate(input) === 'video') {
		const info = await play.video_info(input);
		return { title: info.video_details.title ?? input, url: info.video_details.url };
	}

	const [result] = await play.search(input, { limit: 1 });
	return result ? { title: result.title ?? input, url: result.url } : null;
}

function destroyQueue(guildId: string): void {
	const queue = queues.get(guildId);
	if (!queue) {
		return;
	}

	queue.songs = [];
	queue.player.removeAllListeners();
	queue.player.stop(true);
	queue.connection.destroy();
	queues.delete(guildId);
}

async function playNext(guildId: string): Promise<void> {
	const queue = queues.get(guildId);
	const song = queue?.songs[0];
	if (!queue || !song) {
		destroyQueue(guildId);
		return;
	}

	try {
		const stream = await play.stream(song.url, { discordPlayerCompatibility: true });
		queue.player.play(createAudioResource(stream.stream, { inputType: stream.type }));
	} catch (error) {
		console.error('Failed to stream the audio:', error);
		queue.songs.shift();
		await playNext(guildId);
	}
}

/**
 * Gets the queue of a guild or joins the channel and creates one.
 *
 * @param channel - The voice channel to join
 */
export function ensureQueue(channel: VoiceBasedChannel): GuildQueue {
	const existing = queues.get(channel.guild.id);
	if (existing) {
		return existing;
	}

	const connection = joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator,
		selfDeaf: true,
		selfMute: false,
	});
	const player = createAudioPlayer();
	const queue: GuildQueue = { connection, player, songs: [] };

	const advance = () => {
		queue.songs.shift();
		void playNext(channel.guild.id);
	};

	player.on(AudioPlayerStatus.Idle, advance);
	player.on('error', (error) => {
		console.error('Audio player error:', error);
		advance();
	});

	// Leave the queue when the bot is disconnected from the voice channel
	connection.on(VoiceConnectionStatus.Disconnected, () => {
		entersState(connection, VoiceConnectionStatus.Connecting, 5_000).catch(() => {
			destroyQueue(channel.guild.id);
		});
	});

	connection.subscribe(player);
	queues.set(channel.guild.id, queue);

	return queue;
}

/**
 * Starts the playback of the queue.
 *
 * @param guildId - The id of the guild
 */
export async function startPlayback(guildId: string): Promise<void> {
	await playNext(guildId);
}

/**
 * Stops the playback, clears the queue and leaves the voice channel.
 *
 * @param guildId - The id of the guild
 * @returns Whether there was a queue
 */
export function stopQueue(guildId: string): boolean {
	if (!queues.has(guildId)) {
		return false;
	}

	destroyQueue(guildId);
	return true;
}
