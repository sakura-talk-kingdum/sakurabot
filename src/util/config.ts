/**
 * Server specific identifiers carried over from the previous implementation.
 */
export const REPORT_CHANNEL_ID = '1208987840462200882';
export const AI_CHANNEL_ID = '1450782867335549031';
export const GACHA_FORUM_CHANNEL_ID = '1441416133302419506';
export const BUMP_ROLE_ID = '1209371709451272215';

/**
 * Guild settings used by the DM based timeout release commands.
 */
export const DM_UNTIMEOUT_GUILDS = {
	'/unselfto': { checkPerms: false, guildId: null, modLogId: null },
	's.toleft': { checkPerms: true, guildId: null, modLogId: null },
	'h.toleft': { checkPerms: true, guildId: '1400830654949753023', modLogId: '1400885372480913458' },
} as const satisfies Record<string, { checkPerms: boolean; guildId: string | null; modLogId: string | null }>;
