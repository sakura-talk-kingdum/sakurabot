export default async function timeout(interaction, context) {
  console.error("DEBUG ERROR:", error);
  const { PermissionFlagsBits, parseDuration } = context;

  // 最初に deferReply を実行 (ephemeral: true ならメッセージは自分にだけ見える)
  await interaction.deferReply({ ephemeral: true });

  try {
    // 権限チェック
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
      return await interaction.editReply({ content: '権限がありません' });
    }

    const user = interaction.options.getUser('user');
    const timeStr = interaction.options.getString('time');
    const reason = interaction.options.getString('reason') ?? '理由なし';

    const duration = parseDuration(timeStr);
    if (!duration || duration <= 0) {
      return await interaction.editReply({ content: '時間指定が不正です' });
    }

    // メンバー取得と権限確認
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return await interaction.editReply({ content: '対象のメンバーが見つかりません' });
    }

    if (!member.moderatable) {
      return await interaction.editReply({ content: 'このユーザーをタイムアウトする権限がボットにありません' });
    }

    // 実行
    await member.timeout(duration, reason);

    await interaction.editReply({
      content: `⏱ **${user.tag}** を **${timeStr}** タイムアウトしました\n理由: ${reason}`
    });

  } catch (error) {
    console.error('Timeout Command Error:', error);
    
    // defer しているので editReply または followUp でエラーを通知
    const errorMessage = 'コマンド実行中にエラーが発生しました';
    try {
      await interaction.editReply({ content: errorMessage });
    } catch (err) {
      console.error('Failed to send error message:', err);
    }
  }
}
