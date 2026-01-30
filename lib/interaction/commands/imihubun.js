import * as D from "discord.js"

const CHANNEL_COOLDOWN_MS = 60 * 1000; // 60秒
const ALLOWED_CHANNEL_IDS = [
  "123456789012345678", // #imihubun
  "987654321098765432"
];

const channelCooldowns = new Map();

export default async function imihubun(interaction) {
  await interaction.deferReply();
    if (!interaction.member.roles.cache.has(prosess.env.shiikurole)) {
      await interaction.editReply({
        content: '❌ このコマンドを使用する権限がありません'
      });
      return;
    }
  let wordData = null;
  (async () => {
    const res = await fetch('https://povo-43.github.io/imihubun/words.json');
     wordData = await res.json();
  })();

  const channel = interaction.options.getChannel('channel');

    if (!channel.isTextBased()) {
      await interaction.editReply({
        content: '❌ テキストチャンネルを指定してください'
      });
      return;
    }


  /* ===== チャンネル制限 ===== */
  if (!ALLOWED_CHANNEL_IDS.includes(channel)) {
    return interaction.editReply({
      content: "❌ このコマンドは指定チャンネルでのみ使用できます。",
      ephemeral: true
    });
  }

  /* ===== チャンネル単位クールダウン ===== */
  const now = Date.now();
  const lastUsed = channelCooldowns.get(channel) ?? 0;

  const remaining = CHANNEL_COOLDOWN_MS - (now - lastUsed);
  if (remaining > 0) {
    return interaction.editRreply({
      content: `⏳ このチャンネルではあと **${Math.ceil(remaining / 1000)}秒** 待ってね`,
      ephemeral: true
    });
  }

  // クールダウン更新
  channelCooldowns.set(channel, now);
  
    // テキストチャンネル確認

    const footer = "\n-# By [意味不文ジェネレーター](<https://povo-43.github.io/imihubun>)";
    const main_text = Math.random() > 0.5
      ? (
          wordData.starts[Math.floor(Math.random() * wordData.starts.length)] +
          wordData.subjects[Math.floor(Math.random() * wordData.subjects.length)] +
          wordData.locations[Math.floor(Math.random() * wordData.locations.length)] +
          wordData.actions[Math.floor(Math.random() * wordData.actions.length)] +
          wordData.ends[Math.floor(Math.random() * wordData.ends.length)]
        ) + ' ' + (
          wordData.starts[Math.floor(Math.random() * wordData.starts.length)] +
          wordData.subjects[Math.floor(Math.random() * wordData.subjects.length)] +
          wordData.locations[Math.floor(Math.random() * wordData.locations.length)] +
          wordData.actions[Math.floor(Math.random() * wordData.actions.length)] +
          wordData.ends[Math.floor(Math.random() * wordData.ends.length)]
        )
      : (
          wordData.starts[Math.floor(Math.random() * wordData.starts.length)] +
          wordData.subjects[Math.floor(Math.random() * wordData.subjects.length)] +
          wordData.locations[Math.floor(Math.random() * wordData.locations.length)] +
          wordData.actions[Math.floor(Math.random() * wordData.actions.length)] +
          wordData.ends[Math.floor(Math.random() * wordData.ends.length)]
        )
   
    await channel.send(main_text + footer);
  
    await interaction.editReply({content: `✅ <#${channel.id}> に送信しました`});
  }

  if (!interaction.replied && !interaction.deferred) {
  interaction.reply({ content: '❌ エラーが発生しました', flags: 64 })
  .catch(console.error);
}

