// logger.js
import client from './bot.js';

// 通知を送りたいチャンネルのID
const NOTIFICATION_CHANNEL_ID = '1209507256412938280';

// --- 1. メッセージ編集の検知 ---
client.on('messageUpdate', async (oldMessage, newMessage) => {
    // 編集後のメッセージが partial の場合はデータを完全な状態にフェッチ（取得）する
    if (newMessage.partial) {
        await newMessage.fetch().catch(() => null);
    }
    
    // ボットのメッセージは無視
    if (newMessage.author?.bot) return;
    
    // 内容が変わっていない場合は無視（埋め込みの自動展開など）
    if (oldMessage.content === newMessage.content) return;

    const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    // 変更前の本文がキャッシュにない（null）の場合は「(過去のメッセージのため取得不可)」とする
    const oldContent = oldMessage.partial ? '(過去のメッセージのため取得不可)' : (oldMessage.content || '(本文なし)');
    const newContent = newMessage.content || '(本文なし)';

    channel.send(
        `✏️ **メッセージが編集されました**\n` +
        `送信者: <@${newMessage.author?.id ?? '不明'}> | チャンネル: <#${newMessage.channel.id}>\n` +
        `**変更前:** ${oldContent}\n` +
        `**変更後:** ${newContent}`
    );
});

// --- 2. メッセージ削除の検知 ---
client.on('messageDelete', async (message) => {
    // ボットのメッセージ、またはすでに取得できない状態のボットメッセージを無視
    if (message.author?.bot) return;

    const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    // partial の場合は author や content が null なので、エラーが出ないよう安全にフォールバック
    const authorId = message.author?.id ? `<@${message.author.id}>` : '不明（古いメッセージ）';
    const content = message.partial ? '(過去のメッセージのため本文を取得できませんでした)' : (message.content || '(本文なし)');

    channel.send(
        `🗑️ **メッセージが削除されました**\n` +
        `送信者: ${authorId} | チャンネル: <#${message.channel.id}>\n` +
        `**内容:** ${content}`
    );
});

// --- 3. VCの参加・退出・移動の検知 ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member;
    if (!member || member.user.bot) return; // メンバーが取得できない場合やボットは無視

    const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // 参加 (VCに入っていなかった -> VCに入った)
    if (!oldChannel && newChannel) {
        channel.send(`🔊 <@${member.id}> がボイスチャンネル **${newChannel.name}** に参加しました。`);
    }
    // 退出 (VCに入っていた -> VCからいなくなった)
    else if (oldChannel && !newChannel) {
        channel.send(`🔇 <@${member.id}> がボイスチャンネル **${oldChannel.name}** から退出しました。`);
    }
    // 移動 (別のVCへ移動した)
    else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
        channel.send(`🔄 <@${member.id}> が **${oldChannel.name}** から **${newChannel.name}** に移動しました。`);
    }
});
