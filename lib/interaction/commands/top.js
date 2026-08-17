import { supabase } from '../../db.js';

export default async function ranking(interaction, context) {
  const {
    EmbedBuilder
  } = context;

  // コマンドの引数からタイプ（text / vc）とページ（range）を取得
  // ※ スラッシュコマンド側でデフォルト値を設定していない場合はここでフォールバック
  const type = interaction.options.getString('type') || 'text';
  const range = interaction.options.getInteger('range') || 1;

  // タイプ値の安全チェック
  if (type !== 'text' && type !== 'vc') {
    await interaction.reply({ content: '❌ タイプは "text" または "vc" を指定してください。', flags: 64 });
    return;
  }

  // ページ数の安全チェック（1未満は1に固定）
  const page = Math.max(1, range);

  // 取得対象のカラム名を決定
  const xpColumn = type === 'text' ? 'text_xp' : 'voice_xp';
  const levelColumn = type === 'text' ? 'text_level' : 'voice_level';

  // Supabaseの取得範囲（インデックス）を計算
  // page=1: 0〜9 (1〜10位) | page=2: 10〜19 (11〜20位)
  const from = (page - 1) * 10;
  const to = from + 9;

  // 読み込み中である旨を応答（Supabaseの処理に時間がかかった場合のタイムアウト回避）
  await interaction.deferReply();

  try {
    // Supabaseからデータを取得
    const { data, error } = await supabase
      .from('accounts')
      .select(`user_id, ${xpColumn}, ${levelColumn}`)
      .order(xpColumn, { ascending: false }) // XPが多い順（降順）
      .range(from, to);

    if (error) throw error;

    // データが空の場合
    if (!data || data.length === 0) {
      await interaction.editReply({ content: `❌ 第 ${page} ページのランキングデータはありません。` });
      return;
    }

    // Embedのディスクリプション（ランキング本文）を構築
    const embedDescription = data.map((row, index) => {
      const rank = from + index + 1; // 正確な順位を計算
      return `**${rank}位** | <@${row.user_id}>\n┗ Lv.${row[levelColumn]} (XP: ${row[xpColumn]})`;
    }).join('\n\n');

    // ランキングEmbedを作成
    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${type === 'text' ? 'テキスト' : 'ボイス'} XPランキング`)
      .setDescription(embedDescription)
      .setColor(type === 'text' ? 0x3498db : 0x2ecc71) // タイプごとに色を変更（青 / 緑）
      .setFooter({ text: `ページ: ${page} (${from + 1}位 ～ ${from + data.length}位)` })
      .setTimestamp();

    // 応答を更新
    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('ランキング取得エラー:', error);
    await interaction.editReply({ content: '❌ データの取得中にエラーが発生しました。' });
  }
}
