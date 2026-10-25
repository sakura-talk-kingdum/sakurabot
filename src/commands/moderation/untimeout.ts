import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { clearTimeoutContinuation } from '../../util/moderation.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'untimeout',
		description: 'タイムアウトを解除します',
		options: [{ type: ApplicationCommandOptionType.User, name: 'user', description: '対象ユーザー', required: true }],
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
		const member = await interaction.guild.members.fetch(user.id).catch(() => null);
		if (!member?.moderatable) {
			await interaction.reply({ content: 'このユーザーは解除できません', flags: MessageFlags.Ephemeral });
			return;
		}

		await member.timeout(null);
		await clearTimeoutContinuation(interaction.guild.id, user.id);

		await interaction.reply(`✅ **${user.tag}** のタイムアウトを解除しました`);
	},
} satisfies Command;
