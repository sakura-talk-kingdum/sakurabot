import { createWriteStream, mkdirSync } from 'node:fs';
import type { WriteStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream';
import { EndBehaviorType, joinVoiceChannel } from '@discordjs/voice';
import prism from 'prism-media';
import type { VoiceConnection } from '@discordjs/voice';
import type { VoiceBasedChannel } from 'discord.js';

/**
 * The users that get recorded.
 */
export const RECORD_WHITELIST = ['917633605684056085'];

const RECORD_DIR = join(process.cwd(), 'recordings');

type ActiveRecord = {
	connection: VoiceConnection;
	files: Set<WriteStream>;
};

const activeRecords = new Map<string, ActiveRecord>();

/**
 * Whether a record is running in the voice channel.
 *
 * @param channelId - The id of the voice channel
 */
export function isRecording(channelId: string): boolean {
	return activeRecords.has(channelId);
}

/**
 * Starts to record the whitelisted users of a voice channel as raw PCM files.
 *
 * @param channel - The voice channel to record
 */
export async function startRecording(channel: VoiceBasedChannel): Promise<void> {
	mkdirSync(RECORD_DIR, { recursive: true });

	const connection = joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator,
		selfDeaf: false,
	});
	const record: ActiveRecord = { connection, files: new Set() };
	activeRecords.set(channel.id, record);

	await channel.send(
		`🎙 **録音開始！**\n対象ユーザー:\n${RECORD_WHITELIST.map((id) => `• <@${id}>`).join('\n')}\nこのVCは録音されています。`,
	);

	connection.receiver.speaking.on('start', (userId) => {
		if (!RECORD_WHITELIST.includes(userId)) {
			return;
		}

		// Every utterance gets its own file, the stream ends together with the audio
		const file = createWriteStream(join(RECORD_DIR, `${userId}-${Date.now()}.pcm`));
		record.files.add(file);
		file.once('close', () => record.files.delete(file));

		const audio = connection.receiver.subscribe(userId, {
			end: { behavior: EndBehaviorType.AfterSilence, duration: 500 },
		});
		// The receiver provides Opus packets, decode them to 48kHz stereo 16-bit PCM
		const decoder = new prism.opus.Decoder({ rate: 48_000, channels: 2, frameSize: 960 });

		pipeline(audio, decoder, file, (error) => {
			if (error) {
				console.error('Recording pipeline error:', error);
			}
		});
	});
}

/**
 * Stops the record of a voice channel.
 *
 * @param channel - The voice channel that is recorded
 * @returns Whether a record was running
 */
export async function stopRecording(channel: VoiceBasedChannel): Promise<boolean> {
	const record = activeRecords.get(channel.id);
	if (!record) {
		return false;
	}

	for (const file of record.files) {
		file.end();
	}

	record.connection.destroy();
	activeRecords.delete(channel.id);
	await channel.send('🎙 **録音終了しました！**');
	return true;
}
