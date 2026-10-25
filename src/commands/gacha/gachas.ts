import { ApplicationCommandOptionType, EmbedBuilder, MessageFlags } from 'discord.js';
import { fetchItemsByDisplayId, fetchLogs, findSets, searchSets } from '../../util/gacha.js';
import type { Command } from '../index.js';

export default {
	data: {
		name: 'gachas',
		description: 'ガチャ関連コマンド',
		options: [
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'inventory',
				description: 'ユーザーのガチャ所持状況を見る',
				options: [
					{ type: ApplicationCommandOptionType.User, name: 'user', description: '対象ユーザー', required: true },
					{ type: ApplicationCommandOptionType.String, name: 'gachas', description: 'ガチャ名', required: true },
				],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: 'search',
				description: 'ガチャを名前で検索',
				options: [
					{
						type: ApplicationCommandOptionType.String,
						name: 'name',
						description: '検索するガチャ名',
						required: true,
					},
				],
			},
		],
	},
	async execute(interaction) {
		if (!interaction.inGuild()) {
			await interaction.reply({ content: 'サーバー内でのみ実行できます', flags: MessageFlags.Ephemeral });
			return;
		}

		if (interaction.options.getSubcommand() === 'search') {
			const name = interaction.options.getString('name', true).trim();
			const sets = await searchSets(interaction.guildId, name);

			if (sets.length === 0) {
				await interaction.reply({
					content: `「${name}」に一致するガチャは見つかりませんでした`,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const embed = new EmbedBuilder()
				.setTitle('🔎 ガチャ検索結果')
				.setColor(0x4d_d0_e1)
				.setDescription(
					sets
						.map(
							(set) =>
								`• **${set.name}**\n　トリガー: \`${set.trigger_word ?? '未設定'}\` / 状態: ${set.enabled ? '有効' : '無効'}`,
						)
						.join('\n'),
				);

			await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
			return;
		}

		const user = interaction.options.getUser('user', true);
		const input = interaction.options.getString('gachas', true).trim();
		const sets = await findSets(interaction.guildId, input);

		const [set] = sets;
		if (!set) {
			await interaction.reply({
				content: `「${input}」に一致するガチャが見つかりませんでした`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (sets.length > 1) {
			await interaction.reply({
				content: `候補が複数あります: ${sets.map((candidate) => candidate.name).join(', ')}`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const logs = await fetchLogs(interaction.guildId, set.id, user.id);
		if (logs.length === 0) {
			await interaction.reply({ content: 'まだ何も引いていないようです', flags: MessageFlags.Ephemeral });
			return;
		}

		const displayIds = [...new Set(logs.map((log) => log.display_id).filter((id): id is number => id !== null))];
		const masters = new Map((await fetchItemsByDisplayId(set.id, displayIds)).map((item) => [item.display_id, item]));

		const counts = new Map<string, { count: number; name: string; rarity: string }>();
		for (const log of logs) {
			const master = masters.get(log.display_id);
			const rarity = master?.rarity ?? log.rarity ?? 'unknown';
			const key = `${log.display_id ?? 'none'}__${rarity}`;
			const entry = counts.get(key) ?? { count: 0, name: master?.name ?? `不明なアイテム #${log.display_id}`, rarity };
			entry.count += 1;
			counts.set(key, entry);
		}

		const items = [...counts.values()].sort((a, b) =>
			a.rarity === b.rarity ? b.count - a.count : a.rarity.localeCompare(b.rarity),
		);

		const embed = new EmbedBuilder()
			.setTitle(`🎒 ${user.username} の ${set.name} 所持状況`)
			.setColor(0xf1_c4_0f)
			.setDescription(
				items
					.map((item) => `• ${item.name} [${item.rarity}] x${item.count}`)
					.join('\n')
					.slice(0, 4_000),
			);

		await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
	},
} satisfies Command;
