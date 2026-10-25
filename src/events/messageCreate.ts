import { EmbedBuilder, Events, PermissionFlagsBits } from 'discord.js';
import type { Message } from 'discord.js';
import { addExperience } from '../util/accounts.js';
import { handleAiMessage } from '../util/ai.js';
import { AI_CHANNEL_ID, DM_UNTIMEOUT_GUILDS } from '../util/config.js';
import { env } from '../util/env.js';
import { fetchEnabledSets, runGacha } from '../util/gacha.js';
import { clearTimeoutContinuation } from '../util/moderation.js';
import { getPinned, upsertPinned } from '../util/pins.js';
import type { Event } from './index.js';

async function handleDirectMessage(message: Message): Promise<void> {
	const command = message.content.trim();
	if (!(command in DM_UNTIMEOUT_GUILDS)) {
		return;
	}

	const config = DM_UNTIMEOUT_GUILDS[command as keyof typeof DM_UNTIMEOUT_GUILDS];
	const guildId = config.guildId ?? env.DISCORD_GUILD_ID;
	const modLogId = config.modLogId ?? env.DISCORD_MOD_LOG_CHANNEL_ID;
	if (!guildId) {
		return;
	}

	const guild = await message.client.guilds.fetch(guildId);
	const member = await guild.members.fetch(message.author.id).catch(() => null);

	if (!member) {
		await message.reply('対象のサーバーに所属していません。');
		return;
	}

	if (config.checkPerms && !member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
		await message.reply('この操作を実行する権限がありません。');
		return;
	}

	if (!member.communicationDisabledUntilTimestamp || member.communicationDisabledUntilTimestamp <= Date.now()) {
		await message.reply('現在タイムアウトされていません。');
		return;
	}

	await member.timeout(null, `DM command: ${command}`);
	await clearTimeoutContinuation(guild.id, message.author.id);
	await message.reply(`✅ タイムアウトを解除しました。 (${command})`);

	const log = modLogId ? await guild.channels.fetch(modLogId).catch(() => null) : null;
	if (log?.isSendable()) {
		await log.send(
			`🔓 Timeout Released\nuser: ${message.author.tag} (${message.author.id})\nmethod: DM command ${command}`,
		);
	}
}

/**
 * Re-posts the pinned message of the channel so that it stays at the bottom.
 */
async function repostPinned(message: Message<true>): Promise<void> {
	const pinned = await getPinned(message.channel.id);
	if (!pinned || !message.channel.isSendable()) {
		return;
	}

	const old = await message.channel.messages.fetch(pinned.message_id).catch(() => null);
	await old?.delete().catch(() => null);

	const sent = await message.channel.send({
		embeds: [
			new EmbedBuilder()
				.setDescription(pinned.content)
				.setColor(0x00_ae_86)
				.setFooter({ text: `📌 投稿者: ${pinned.author_name ?? '不明'}` })
				.setTimestamp(),
		],
	});

	await upsertPinned({ ...pinned, message_id: sent.id });
}

async function handleGuildMessage(message: Message<true>): Promise<void> {
	const content = message.content.trim();
	const sets = await fetchEnabledSets(message.guild.id);
	const matched = sets.find((set) => set.channel_id === message.channel.id && set.trigger_word === content);

	if (matched) {
		await runGacha(message, matched);
		return;
	}

	if (message.channel.id === AI_CHANNEL_ID) {
		await handleAiMessage(message);
		return;
	}

	await repostPinned(message);
	await addExperience(message.author.id, 'text');
}

export default {
	name: Events.MessageCreate,
	async execute(message) {
		if (message.author.bot) {
			return;
		}

		if (message.inGuild()) {
			await handleGuildMessage(message);
		} else {
			await handleDirectMessage(message).catch(async (error: unknown) => {
				console.error('DM command failed:', error);
				await message.reply('処理中にエラーが発生しました。').catch(() => null);
			});
		}
	},
} satisfies Event<Events.MessageCreate>;
