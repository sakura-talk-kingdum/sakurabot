import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { deletePinned, getPinned } from '../../util/pins.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'unpin',
		description: 'チャンネルにあるメッセージ固定を解除します',
		default_member_permissions: PermissionFlagsBits.Administrator.toString(),
	},
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: '権限がありません', flags: MessageFlags.Ephemeral });
			return;
		}

		const { channel } = interaction;
		const pinned = channel ? await getPinned(channel.id) : null;
		if (!channel || !pinned) {
			await interaction.reply({
				content: '❌ このチャンネルには固定メッセージがありません',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const message = await channel.messages.fetch(pinned.message_id).catch(() => null);
		await message?.delete().catch(() => null);
		await deletePinned(channel.id);

		await interaction.reply({ content: '🗑️ 固定メッセージを解除しました！', flags: MessageFlags.Ephemeral });
	},
} satisfies Command;
