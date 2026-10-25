import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { env } from '../../util/env.js';
import type { Command } from '../index.js';

const WORDS_URL = 'https://povo-43.github.io/imihubun/words.json';
const COOLDOWN_MS = 60_000;
const FOOTER = '\n-# By [意味不文ジェネレーター](<https://povo-43.github.io/imihubun>)';

type Words = Record<'actions' | 'ends' | 'locations' | 'starts' | 'subjects', string[]>;

const cooldowns = new Map<string, number>();

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)] ?? '';

function sentence(words: Words): string {
	return pick(words.starts) + pick(words.subjects) + pick(words.locations) + pick(words.actions) + pick(words.ends);
}

export default {
	data: {
		name: 'imihubun',
		description: '[飼育員]imihubunを送信',
		options: [
			{
				type: ApplicationCommandOptionType.Channel,
				name: 'channel',
				description: '送信先チャンネル',
				required: true,
			},
		],
	},
	async execute(interaction) {
		if (!interaction.inCachedGuild()) {
			await interaction.reply({ content: 'サーバー内でのみ実行できます', flags: MessageFlags.Ephemeral });
			return;
		}

		if (!env.SHIIKU_ROLE_ID || !interaction.member.roles.cache.has(env.SHIIKU_ROLE_ID)) {
			await interaction.reply({ content: '❌ このコマンドを使用する権限がありません', flags: MessageFlags.Ephemeral });
			return;
		}

		const channel = interaction.options.getChannel('channel', true);
		if (!('send' in channel) || !channel.isTextBased()) {
			await interaction.reply({ content: '❌ テキストチャンネルを指定してください', flags: MessageFlags.Ephemeral });
			return;
		}

		if (!env.IMIHUBUN_CHANNEL_IDS.includes(channel.id)) {
			await interaction.reply({
				content: '❌ このコマンドは指定チャンネルでのみ使用できます。',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const remaining = COOLDOWN_MS - (Date.now() - (cooldowns.get(channel.id) ?? 0));
		if (remaining > 0) {
			await interaction.reply({
				content: `⏳ このチャンネルではあと **${Math.ceil(remaining / 1_000)}秒** 待ってね`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const response = await fetch(WORDS_URL);
		if (!response.ok) {
			await interaction.editReply('❌ 単語リストの取得に失敗しました');
			return;
		}

		const words = (await response.json()) as Words;
		const text = Math.random() > 0.5 ? `${sentence(words)} ${sentence(words)}` : sentence(words);

		cooldowns.set(channel.id, Date.now());
		await channel.send(text + FOOTER);
		await interaction.editReply(`✅ <#${channel.id}> に送信しました`);
	},
} satisfies Command;
