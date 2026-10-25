import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { createAccount, deleteAccount, modifyExperience, modifyLevel, transferAccount } from '../../util/accounts.js';
import type { ExperienceType, Operation } from '../../util/accounts.js';
import type { Command } from '../index.js';

const operationChoices = [
	{ name: 'add', value: 'add' },
	{ name: 'set', value: 'set' },
	{ name: 'remove', value: 'remove' },
];

const typeChoices = [
	{ name: 'text', value: 'text' },
	{ name: 'voice', value: 'voice' },
];

const userOption = (name: string, description: string) =>
	({ type: ApplicationCommandOptionType.User, name, description, required: true }) as const;

const modifyOptions = [
	userOption('user', '対象ユーザー'),
	{
		type: ApplicationCommandOptionType.String,
		name: 'type',
		description: '種類',
		required: true,
		choices: typeChoices,
	},
	{
		type: ApplicationCommandOptionType.String,
		name: 'operation',
		description: '操作種別',
		required: true,
		choices: operationChoices,
	},
	{ type: ApplicationCommandOptionType.Integer, name: 'value', description: '変更量', required: true, min_value: 0 },
] as const;

export default {
	data: {
		name: 'admin',
		description: '管理者向けアカウント操作',
		default_member_permissions: PermissionFlagsBits.Administrator.toString(),
		options: [
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'account-create',
				description: 'ユーザーのアカウントを作成',
				options: [userOption('user', '対象ユーザー')],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'account-delete',
				description: 'ユーザーのアカウントを削除',
				options: [userOption('user', '対象ユーザー')],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'account-transfer',
				description: 'アカウントを別ユーザーに移行',
				options: [userOption('old', '移行元ユーザー'), userOption('new', '移行先ユーザー')],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'account-xp',
				description: 'XPを操作',
				options: [...modifyOptions],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'account-level',
				description: 'レベルを操作',
				options: [...modifyOptions],
			},
		],
	},
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({ content: '🚫 このコマンドは管理者専用だよ〜！', flags: MessageFlags.Ephemeral });
			return;
		}

		switch (interaction.options.getSubcommand()) {
			case 'account-create': {
				const user = interaction.options.getUser('user', true);
				const created = await createAccount(user.id);
				await interaction.reply(
					created ? `🎉 **${user.username}** のアカウント作ったよ！` : 'そのユーザーはもう登録済みだよ！',
				);
				break;
			}

			case 'account-delete': {
				const user = interaction.options.getUser('user', true);
				const deleted = await deleteAccount(user.id);
				await interaction.reply(
					deleted ? `🗑️ **${user.username}** のアカウント消したよ！` : 'そのユーザーのアカウントはないよ！',
				);
				break;
			}

			case 'account-transfer': {
				const oldUser = interaction.options.getUser('old', true);
				const newUser = interaction.options.getUser('new', true);
				const moved = await transferAccount(oldUser.id, newUser.id);
				await interaction.reply(
					moved
						? `🔁 **${oldUser.username} → ${newUser.username}** にデータ移行したよ！`
						: '移行元のアカウントが見つからないよ！',
				);
				break;
			}

			case 'account-xp':
			case 'account-level': {
				const user = interaction.options.getUser('user', true);
				const type = interaction.options.getString('type', true) as ExperienceType;
				const operation = interaction.options.getString('operation', true) as Operation;
				const value = interaction.options.getInteger('value', true);
				const modify = interaction.options.getSubcommand() === 'account-xp' ? modifyExperience : modifyLevel;

				const found = await modify(user.id, type, operation, value);
				await interaction.reply(
					found
						? `${interaction.options.getSubcommand() === 'account-xp' ? 'XP' : 'Level'} を ${type} で ${operation} ${value} したよ！`
						: 'そのユーザーのアカウントはないよ！',
				);
				break;
			}

			default:
				await interaction.reply({ content: '未対応のサブコマンドだよ。', flags: MessageFlags.Ephemeral });
		}
	},
} satisfies Command;
