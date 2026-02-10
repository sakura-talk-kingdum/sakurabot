export default async function record(interaction, context) {
  const { startRecord, stopRecord, MessageFlags } = context;
  const sub = interaction.options.getSubcommand(false);

  try {
    if (sub === "start") {
      // 実処理は record.js に丸投げ
      console.log("[DEBUG] sub発火OK");
      const res = await startRecord(interaction); // startRecord は interaction.editReply を内部で呼ぶ設計でもOK
      // もし startRecord が結果を返すなら editReply で反映
      if (res && typeof res === "string") {
        await interaction.editReply(res);
      } else {
        await interaction.editReply("録音開始処理を実行したよ。");
      }
      return;
    }

    if (sub === "stop") {
      const res = await stopRecord(interaction);
      if (res && typeof res === "string") {
        await interaction.editReply(res);
      } else {
        await interaction.editReply("録音停止したよ。");
      }
      return;
    }

    // 未対応サブコマンド
    await interaction.editReply("未対応のサブコマンドだよ。");
  } catch (err) {
    console.error("interaction error:", err);
    // 既に defer してるかどうかで返信方法を切り替える
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply("エラーが発生したよ。管理者に確認してね。");
    } else {
      await interaction.reply({ content: "エラーが発生したよ。", flags: MessageFlags.Ephemeral });
    }
    // 追加: ここで errorReporter に投げても良い
  }
}
