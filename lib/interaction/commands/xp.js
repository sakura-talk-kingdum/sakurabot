import { supabase } from '../../../db.js';

export default async function xp(interaction, context) {
  const {
    EmbedBuilder
  } = context;

  // 1. userオプション（User型）から取得（無ければ実行者）
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const targetId = targetUser.id;

  await interaction.deferReply();

  try {
    // 2. 対象ユーザーのデータを取得
    const { data: userData, error: userError } = await supabase
      .from('accounts')
      .select('text_xp, text_level, voice_xp, voice_level')
      .eq('user_id', targetId)
      .single();

    // データが存在しない場合
    if (userError || !userData) {
      await interaction.editReply({ content: `❌ ${targetUser} のXPデータが見つかりませんでした。` });
      return;
    }

    // 3. テキストXPの順位を計算（自分よりXPが高いユーザーの数を数える）
    const { count: textRankCount, error: textRankError } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true }) // head:true でデータ本体ではなく件数だけを取得
      .gt('text_xp', userData.text_xp);

    // 4. ボイスXPの順位を計算
    const { count: voiceRankCount, error: voiceRankError } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .gt('voice_xp', userData.voice_xp);

    if (textRankError || voiceRankError) throw new Error('順位の取得に失敗しました');

    // 自分より高い人が0人なら1位、1人なら2位になるため「+1」する
    const textRank = (textRankCount || 0) + 1;
    const voiceRank = (voiceRankCount || 0) + 1;

    // 5. 結果を表示するEmbedを作成
    const embed = new EmbedBuilder()
      .setTitle(`📊 XPステータス & ランキング`)
      .setDescription(`${targetUser} の現在のステータス`)
      .setColor(0x3498db)
      .addFields(
        { 
          name: '💬 テキスト', 
          value: `**順位**: \`${textRank}位\`\n**Lv.${userData.text_level}** (${userData.text_xp} XP)`, 
          inline: true 
        },
        { 
          name: '🎙️ ボイス', 
          value: `**順位**: \`${voiceRank}位\`\n**Lv.${userData.voice_level}** (${userData.voice_xp} XP)`, 
          inline: true 
        }
      )
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('XP/ランキング取得エラー:', error);
    await interaction.editReply({ content: '❌ データの取得、または順位の計算中にエラーが発生しました。' });
  }
}
