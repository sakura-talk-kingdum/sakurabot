import { InferenceClient } from '@huggingface/inference';
import { EmbedBuilder } from 'discord.js';
import type { Message } from 'discord.js';
import { env } from './env.js';

type ChatMessage = { content: string; role: 'assistant' | 'system' | 'user' };

const COOLDOWN_MS = 3_000;
const HISTORY_LIMIT = 10;
const SYSTEM_PROMPT = [
	'あなたはユーザーの長年の「親友（幼馴染や親友のような関係）」です。以下のルールを厳格に守って日本語で会話してください。',
	'1. 敬語や丁寧語（です・ます等）は絶対に禁止。完全なタメ口で話すこと。',
	'2. 「～じゃん」「～だよね」「～だろ」「～じゃん？」など、自然で親しみやすい口調にする。',
	'3. チャラい言葉（「ウェーイ」など）や、軽薄な喋り方は絶対にしないこと。落ち着きつつもフランクな距離感を保つ。',
	'4. 知らないことは知ったかぶりせず、「それは知らないわ」「聞いたことないな」と素直に言うこと。',
	'5. 相手を突き放さず、親身になって相談に乗ったり、冗談を言い合ったりする温かい距離感で接すること。',
].join('\n');

const inference = new InferenceClient(env.HF_TOKEN);
const lastUsed = new Map<string, number>();
const histories = new Map<string, ChatMessage[]>();

/**
 * Answers a message of the AI channel with a chat completion.
 *
 * @param message - The message to answer
 */
export async function handleAiMessage(message: Message): Promise<void> {
	const now = Date.now();
	const remaining = COOLDOWN_MS - (now - (lastUsed.get(message.author.id) ?? 0));

	if (remaining > 0) {
		await message.reply({
			embeds: [
				new EmbedBuilder()
					.setTitle('⏱ クールダウン')
					.setDescription(`あと **${(remaining / 1_000).toFixed(1)}秒**`)
					.setColor(0xff_66_66),
			],
		});
		return;
	}

	if (!env.HF_TOKEN) {
		await message.reply('⚠️ HF_TOKEN が設定されていません。');
		return;
	}

	lastUsed.set(message.author.id, now);

	const thinking = await message.reply({
		embeds: [new EmbedBuilder().setDescription('Thinking…').setColor(0xaa_aa_aa)],
	});

	try {
		const history = histories.get(message.author.id) ?? [];
		const response = await inference.chatCompletion({
			model: 'google/gemma-3-12b-it',
			messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content: message.content }],
			max_tokens: 1_028,
		});
		const text = response.choices[0]?.message.content ?? '……（返答が空でした）';

		histories.set(
			message.author.id,
			[
				...history,
				{ role: 'user', content: message.content } as const,
				{ role: 'assistant', content: text } as const,
			].slice(-HISTORY_LIMIT),
		);

		await thinking.edit({
			embeds: [
				new EmbedBuilder()
					.setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
					.setDescription(text.slice(0, 4_000))
					.setColor(0x55_ff_99)
					.setFooter({ text: 'powered by Hugging Face (Gemma3 12B)' }),
			],
		});
	} catch (error) {
		lastUsed.delete(message.author.id);
		console.error('AI error:', error);
		await thinking.edit({
			embeds: [new EmbedBuilder().setDescription('⚠️ AIエラーが発生しました。').setColor(0xed_42_45)],
		});
	}
}
