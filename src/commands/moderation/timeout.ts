import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { parseDurationDetailed } from '../../util/duration.js';
import { clearTimeoutContinuation, scheduleTimeoutContinuation } from '../../util/moderation.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'timeout',
		description: 'ユーザーをタイムアウトします',
		options: [
			{ type: ApplicationCommandOptionType.User, name: 'user', description: '対象ユーザー', required: true },
			{
				type: ApplicationCommandOptionType.String,
				name: 'time',
				description: '時間 (例: 1h 10m max)',
				required: true,
			},
			{ type: ApplicationCommandOptionType.String, name: 'reason', description: '理由' },
		],
	},
	async execute(interaction) {
		if (!interaction.inCachedGuild()) {
			await interaction.reply({ content: 'サーバー内でのみ実行できます', flags: MessageFlags.Ephemeral });
			return;
		}

		if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
			await interaction.reply({ content: '権限がありません', flags: MessageFlags.Ephemeral });
			return;
		}

		const user = interaction.options.getUser('user', true);
		const timeString = interaction.options.getString('time', true);
		const reason = interaction.options.getString('reason') ?? '理由なし';

		const detail = parseDurationDetailed(timeString);
		if (detail.cappedMs <= 0) {
			await interaction.reply({ content: '時間指定が不正です', flags: MessageFlags.Ephemeral });
			return;
		}

		const member = await interaction.guild.members.fetch(user.id).catch(() => null);
		if (!member?.moderatable) {
			await interaction.reply({ content: 'このユーザーはタイムアウトできません', flags: MessageFlags.Ephemeral });
			return;
		}

		await member.timeout(detail.cappedMs, reason);

		const continues = detail.totalMs > detail.cappedMs && !detail.usedMax;
		if (continues && detail.targetUntil && detail.nextApplyAt) {
			await scheduleTimeoutContinuation({
				guildId: interaction.guild.id,
				userId: user.id,
				reason,
				targetUntil: detail.targetUntil,
				nextApplyAt: detail.nextApplyAt,
			});
		} else {
			await clearTimeoutContinuation(interaction.guild.id, user.id);
		}

		await interaction.reply(
			continues
				? `⏱ **${user.tag}** をまず最大期間でタイムアウトしました。期限まで自動で再適用します。`
				: `⏱ **${user.tag}** を **${timeString}** タイムアウトしました`,
		);
	},
} satisfies Command;
