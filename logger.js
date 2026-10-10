// logger.js
import client from './bot.js';

// 通知を送りたいチャンネルのID
const NOTIFICATION_CHANNEL_ID = '1209507256412938280';

// --- 1. メッセージ編集の検知 ---
client.on('messageUpdate', async (oldMessage, newMessage) => {
    // ボット自身のメッセージや部分的なキャッシュは無視する場合のガード
    if (oldMessage.partial || newMessage.partial) return;
    if (oldMessage.author?.bot) return;
    // 内容が変わっていない場合は無視
    if (oldMessage.content === newMessage.content) return;

    const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    channel.send(
        `✏️ **メッセージが編集されました**\n` +
        `送信者: <@${newMessage.author.id}> | チャンネル: <#${newMessage.channel.id}>\n` +
        `**変更前:** ${oldMessage.content}\n` +
        `**変更後:** ${newMessage.content}`
    );
});

// --- 2. メッセージ削除の検知 ---
client.on('messageDelete', async (message) => {
    if (message.author?.bot) return;

    const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    channel.send(
        `🗑️ **メッセージが削除されました**\n` +
        `送信者: <@${message.author?.id ?? '不明'}> | チャンネル: <#${message.channel.id}>\n` +
        `**内容:** ${message.content || '(本文なし)'}`
    );
});

// --- 3. VCの参加・退出・移動の検知 ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member;
    if (member.user.bot) return;

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
