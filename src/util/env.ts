import process from 'node:process';
import { z } from 'zod';

// Empty values (`KEY=` in .env) are treated as unset
const optionalString = z.preprocess((value) => (value === '' ? undefined : value), z.string().optional());

/**
 * Defines the schema for the optional environment variables used by the bot.
 *
 * `DISCORD_TOKEN` and `APPLICATION_ID` are read directly where they are needed.
 */
const schema = z.object({
	DATABASE_URL: optionalString,
	DISCORD_GUILD_ID: optionalString,
	DISCORD_MOD_LOG_CHANNEL_ID: optionalString,
	DISCORD_CHAT_CHANNEL_ID: optionalString,
	HF_TOKEN: optionalString,
	IMIHUBUN_CHANNEL_IDS: z
		.string()
		.optional()
		.transform((value) =>
			(value ?? '')
				.split(',')
				.map((id) => id.trim())
				.filter((id) => id.length > 0),
		),
	SHIIKU_ROLE_ID: optionalString,
});

export const env = schema.parse(process.env);
