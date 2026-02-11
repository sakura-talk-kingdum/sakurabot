export default async function gachas(interaction,context) {
  const {
    EmbedBuilder,
    supabase,
    sub
  } = context;
/* =====================
   /gachas inventory
===================== */
if (sub === 'inventory') {
  await interaction.deferReply({ ephemeral: true })

  const targetUser = interaction.options.getUser('user') || interaction.user
  const gachaName = interaction.options.getString('gachas')

  // 1. セットIDを取得
  const { data: sets } = await supabase
    .from('gacha_sets')
    .select('id, name')
    .eq('guild_id', 'guild')
    .ilike('name', `%${gachaName}%`)

  if (!sets || sets.length === 0) {
    return await interaction.editReply('❌ ガチャが見つからない')
  }

  const setIds = sets.map(s => s.id)

  // 2. ログを取得し、gacha_items から名前を結合して持ってくる
  const { data: logs, error } = await supabase
    .from('gacha_logs')
    .select(`
      display_id,
      rarity,
      gacha_items!inner(name) 
    `) // display_idを使ってアイテム名を取得
    .eq('user_id', targetUser.id)
    .in('set_id', setIds)

  if (error || !logs || logs.length === 0) {
    return await interaction.editReply('📦 まだ何も持っていないようです')
  }

  // 3. 重複除外（アイテム名で判定）
  const uniq = new Map()
  for (const l of logs) {
    const name = l.gacha_items.name // 結合した名前
    if (!uniq.has(name)) {
      uniq.set(name, { name, rarity: l.rarity })
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎒 ${targetUser.username} のインベントリ`)
    .setDescription(`🎰 ${sets.map(s => s.name).join(', ')}`)
    .setColor(0x5865F2)
    .setFooter({ text: `全 ${uniq.size} 種類` })

  // 25件まで表示
  const itemsToShow = [...uniq.values()].slice(0, 25)
  for (const item of itemsToShow) {
    embed.addFields({
      name: item.name,
      value: `⭐ ${item.rarity}`,
      inline: true
    })
  }

  await interaction.editReply({ embeds: [embed] })
}


    /* =====================
       /gachas search（例）
    ===================== */
    if (sub === 'search') {
      await interaction.deferReply({ ephemeral: true })

      const name = interaction.options.getString('name')

      const { data } = await supabase
        .from('gacha_sets')
        .select('name, trigger_word')
        .ilike('name', `%${name}%`)

      if (!data || data.length === 0) {
        await interaction.editReply('🔍 見つからない')
      } else {
        const embed = new EmbedBuilder()
          .setTitle('🎰 ガチャ検索結果')
          .setColor(0x2ecc71)

        for (const g of data) {
          embed.addFields({
            name: g.name,
            value: `trigger: ${g.trigger_word}`
          })
        }

        await interaction.editReply({ embeds: [embed] })
      }
    }
  }
