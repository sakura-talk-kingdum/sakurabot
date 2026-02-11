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

      const targetUser = interaction.options.getUser('user')
      const gachaName = interaction.options.getString('gachas')

      const { data: sets } = await supabase
        .from('gacha_sets')
        .select('id,name')
        .eq('guild_id', interaction.guild.id)
        .ilike('name', `%${gachaName}%`)

      if (!sets || sets.length === 0) {
        await interaction.editReply('❌ ガチャが見つからない')
      } else {
        const setIds = sets.map(s => s.id)

        const { data: logs } = await supabase
          .from('gacha_logs')
          .select('item_name, rarity')
          .eq('user_id', targetUser.id)
          .in('set_id', setIds)

        if (!logs || logs.length === 0) {
          await interaction.editReply('📦 まだ引いてない')
        } else {
          const uniq = new Map()
          for (const l of logs) {
            if (uniq.has(l.item_name) === false) {
              uniq.set(l.item_name, l)
            }
          }

          const embed = new EmbedBuilder()
            .setTitle(`🎒 ${targetUser.username} のインベントリ`)
            .setDescription(`🎰 ${sets.map(s => s.name).join(', ')}`)
            .setColor(0x5865F2)
            .setFooter({ text: `被り除外 ${uniq.size} 種類` })

          for (const v of [...uniq.values()].slice(0, 25)) {
            embed.addFields({
              name: v.item_name,
              value: `⭐ ${v.rarity}`,
              inline: true
            })
          }

          await interaction.editReply({ embeds: [embed] })
        }
      }
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
