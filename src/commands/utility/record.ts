import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { isRecording, startRecording, stopRecording } from '../../util/record.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'record',
		description: 'VC録音の開始/停止',
		default_member_permissions: PermissionFlagsBits.Administrator.toString(),
		options: [
			{ type: ApplicationCommandOptionType.Subcommand, name: 'start', description: '録音を開始します' },
			{ type: ApplicationCommandOptionType.Subcommand, name: 'stop', description: '録音を停止します' },
		],
	},
	async execute(interaction) {
		if (!interaction.inCachedGuild()) {
			await interaction.reply({ content: 'サーバー内でのみ実行できます', flags: MessageFlags.Ephemeral });
			return;
		}

		if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: '権限がありません', flags: MessageFlags.Ephemeral });
			return;
		}

		const channel = interaction.member.voice.channel;
		if (!channel) {
			await interaction.reply({ content: 'VCに居ないよ！', flags: MessageFlags.Ephemeral });
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (interaction.options.getSubcommand() === 'start') {
			if (isRecording(channel.id)) {
				await interaction.editReply('もう録音してるよ！');
				return;
			}

			await startRecording(channel);
			await interaction.editReply('録音を開始したよ！');
			return;
		}

		await interaction.editReply((await stopRecording(channel)) ? '録音停止したよ！' : '録音してないよ');
	},
} satisfies Command;
