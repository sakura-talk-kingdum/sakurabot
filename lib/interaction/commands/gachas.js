const UUID_V4_OR_V1 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function gachas(interaction, context) {
  const { supabase, EmbedBuilder, MessageFlags } = context;

  if (!interaction.inGuild() || !interaction.guild) {
    return interaction.reply({
      content: "サーバー内でのみ実行できます",
      flags: MessageFlags.Ephemeral
    });
  }

  const sub = interaction.options.getSubcommand(false);

  if (sub === "search") {
    const name = interaction.options.getString("name", true).trim();

    const { data: sets, error } = await supabase
      .from("gacha_sets")
      .select("id,name,trigger_word,enabled")
      .eq("guild_id", interaction.guild.id)
      .ilike("name", `%${name}%`)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("gachas search error:", error);
      return interaction.reply({
        content: "検索中にエラーが発生しました",
        flags: MessageFlags.Ephemeral
      });
    }

    if (!sets || sets.length === 0) {
      return interaction.reply({
        content: `「${name}」に一致するガチャは見つかりませんでした`,
        flags: MessageFlags.Ephemeral
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("🔎 ガチャ検索結果")
      .setColor(0x4dd0e1)
      .setDescription(
        sets
          .map(
            set =>
              `• **${set.name}**\n　トリガー: \`${set.trigger_word ?? "未設定"}\` / 状態: ${set.enabled ? "有効" : "無効"}`
          )
          .join("\n")
      );

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  if (sub === "inventory") {
    const targetUser = interaction.options.getUser("user", true);
    const input = interaction.options.getString("gachas", true).trim();

    let sets;
    let setError;

    const setQuery = supabase
      .from("gacha_sets")
      .select("id,name,trigger_word")
      .eq("guild_id", interaction.guild.id)
      .limit(5);

    if (UUID_V4_OR_V1.test(input)) {
      ({ data: sets, error: setError } = await setQuery.or(`id.eq.${input},name.eq.${input},trigger_word.eq.${input}`));
    } else {
      ({ data: sets, error: setError } = await setQuery.or(`name.eq.${input},trigger_word.eq.${input}`));
    }

    if (!setError && (!sets || sets.length === 0)) {
      ({ data: sets, error: setError } = await supabase
        .from("gacha_sets")
        .select("id,name,trigger_word")
        .eq("guild_id", interaction.guild.id)
        .ilike("name", `%${input}%`)
        .limit(5));
    }

    if (setError) {
      console.error("gachas inventory set lookup error:", setError);
      return interaction.reply({
        content: "ガチャ情報の取得に失敗しました",
        flags: MessageFlags.Ephemeral
      });
    }

    if (!sets || sets.length === 0) {
      return interaction.reply({
        content: `「${input}」に一致するガチャが見つかりませんでした`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (sets.length > 1) {
      return interaction.reply({
        content: `候補が複数あります: ${sets.map(s => s.name).join(", ")}`,
        flags: MessageFlags.Ephemeral
      });
    }

    const set = sets[0];

    const { data: logs, error: logsError } = await supabase
      .from("gacha_logs")
      .select("item_name,rarity")
      .eq("guild_id", interaction.guild.id)
      .eq("set_id", set.id)
      .eq("user_id", targetUser.id);

    if (logsError) {
      console.error("gachas inventory logs error:", logsError);
      return interaction.reply({
        content: "所持状況の取得に失敗しました",
        flags: MessageFlags.Ephemeral
      });
    }

    if (!logs || logs.length === 0) {
      return interaction.reply({
        content: "まだ何も引いていないようです",
        flags: MessageFlags.Ephemeral
      });
    }

    const countMap = new Map();
    for (const row of logs) {
      const key = `${row.item_name}__${row.rarity}`;
      const current = countMap.get(key) ?? { itemName: row.item_name, rarity: row.rarity, count: 0 };
      current.count += 1;
      countMap.set(key, current);
    }

    const items = [...countMap.values()].sort((a, b) => {
      if (a.rarity === b.rarity) return b.count - a.count;
      return a.rarity.localeCompare(b.rarity);
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎒 ${targetUser.username} の ${set.name} 所持状況`)
      .setColor(0xf1c40f)
      .setDescription(items.map(i => `• ${i.itemName} [${i.rarity}] x${i.count}`).join("\n"));

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  return interaction.reply({
    content: "未対応のサブコマンドです",
    flags: MessageFlags.Ephemeral
  });
}
