export default async function gatyareload(interaction, context) {
  const { EmbedBuilder, GatyaLoad } = context;
  const embed = new EmbedBuilder()
    .setTitle("ガチャ設定再読み込み")
    .setColor(0x4dd0e1)
    .setDescription("設定の再読み込み処理を開始しました")
    .setTimestamp();

  interaction.reply({ embeds: [embed] });

  await GatyaLoad();
}
