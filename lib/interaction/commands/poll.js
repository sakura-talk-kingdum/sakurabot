const wait = ms => new Promise(res => setTimeout(res, ms));

export default async function poll(interaction, context) {
  const { EmbedBuilder, MessageFlags } = context;
  const title = interaction.options.getString("title");
  const rawData = interaction.options.getString("data");

  try {
    await interaction.deferReply({ ephemeral: false });

    const pairs = rawData.split(",").map(x => x.trim());
    const choices = [];

    for (const pair of pairs) {
      const match = pair.match(/^([a-z])_'(.+)'$/i);
      if (!match) continue;

      const key = match[1].toLowerCase();
      const text = match[2];

      choices.push({ key, text });
    }

    if (choices.length === 0) {
      return interaction.editReply("❌ データ形式が正しくないよ！");
    }

    const description = choices
      .map(c => `:regional_indicator_${c.key}:  ${c.text}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0xff77aa);

    const sent = await interaction.editReply({ embeds: [embed] });

    for (const c of choices) {
      const base = "🇦".codePointAt(0); // OK
      // だが offset 計算は問題なし。これは許容
      const offset = c.key.charCodeAt(0) - 97;
      const emoji = String.fromCodePoint(base + offset);

      await sent.react(emoji).catch(() => {});
      await wait(450); // 防レート制限
    }

  } catch (err) {
    console.error("Error in /poll:", err);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: "❌ エラーが発生したよ！", flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
}
