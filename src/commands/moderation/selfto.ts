import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { parseDurationDetailed } from '../../util/duration.js';
import { clearTimeoutContinuation, scheduleTimeoutContinuation } from '../../util/moderation.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'selfto',
		description: '自分自身をタイムアウトします',
		options: [
			{
				type: ApplicationCommandOptionType.String,
				name: 'time',
				description: '時間 (例: 1d, 12h, 1w 2d, max)',
			},
		],
	},
	async execute(interaction) {
		if (!interaction.inCachedGuild()) {
			await interaction.reply({ content: 'サーバー内でのみ実行できます', flags: MessageFlags.Ephemeral });
			return;
		}

		const timeString = interaction.options.getString('time') ?? '1d';
		const detail = parseDurationDetailed(timeString);
		if (detail.cappedMs <= 0) {
			await interaction.reply({ content: '時間指定が不正です', flags: MessageFlags.Ephemeral });
			return;
		}

		const member = await interaction.guild.members.fetch(interaction.user.id);
		if (!member.moderatable) {
			await interaction.reply({ content: 'あなたはタイムアウトできません', flags: MessageFlags.Ephemeral });
			return;
		}

		const reason = 'Self timeout by /selfto';
		await member.timeout(detail.cappedMs, reason);

		const continues = detail.totalMs > detail.cappedMs && !detail.usedMax;
		if (continues && detail.targetUntil && detail.nextApplyAt) {
			await scheduleTimeoutContinuation({
				guildId: interaction.guild.id,
				userId: interaction.user.id,
				reason,
				targetUntil: detail.targetUntil,
				nextApplyAt: detail.nextApplyAt,
			});
		} else {
			await clearTimeoutContinuation(interaction.guild.id, interaction.user.id);
		}

		await interaction.reply({
			content: continues
				? '⏱ 自分自身をまず最大期間でタイムアウトしました。期限まで自動で再適用します。解除はDMで `/unselfto` を送信してください。'
				: `⏱ 自分自身を **${timeString}** タイムアウトしました。解除はDMで \`/unselfto\` を送信してください。`,
			flags: MessageFlags.Ephemeral,
		});
	},
} satisfies Command;
