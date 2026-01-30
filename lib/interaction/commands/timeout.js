import * as D from "discord.js"

function parseDuration(str) {
  // max, w を正規表現に追加。特定の日にち(2025-12-31等)にもマッチするよう修正
  const regex = /(\d{4}-\d{2}-\d{2})|(\d+)\s*(max|w|d|h|m|s)/gi
  let ms = 0

  for (const m of str.matchAll(regex)) {
    // 日付指定（YYYY-MM-DD）の場合
    if (m[1]) {
      const target = new Date(m[1]).setHours(0, 0, 0, 0)
      const diff = target - Date.now()
      if (diff > 0) ms += diff
      continue
    }

    const v = Number(m[2])
    const u = m[3].toLowerCase()
    
    if (u === 'max') ms += 2419200000 // 28日
    else if (u === 'w') ms += v * 604800000
    else if (u === 'd') ms += v * 86400000
    else if (u === 'h') ms += v * 3600000
    else if (u === 'm') ms += v * 60000
    else if (u === 's') ms += v * 1000
  }

  // Discordの仕様上、最大28日を超えないように制限
  return Math.min(ms, 2419200000)
}

export default async function timeout(interaction) {

    if (!interaction.memberPermissions.has(D.PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: '権限がありません', ephemeral: true })
      return;
    }

    const user = interaction.options.getUser('user')
    const timeStr = interaction.options.getString('time')
    const reason = interaction.options.getString('reason') ?? '理由なし'

    const duration = parseDuration(timeStr)
    if (!duration || duration <= 0) {
      await interaction.reply({ content: '時間指定が不正です', ephemeral: true })
      return
    }

    const member = await interaction.guild.members.fetch(user.id)

    if (!member.moderatable) {
      await interaction.reply({ content: 'このユーザーはタイムアウトできません', ephemeral: true })
      return
    }

    await member.timeout(duration, reason)

    await interaction.reply({
      content: `⏱ **${user.tag}** を **${timeStr}** タイムアウトしました`
    })
    return
  }
