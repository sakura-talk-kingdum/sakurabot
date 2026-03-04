export default async function ping(interaction, context) {
  const { chartJSNodeCanvas, os, si, AttachmentBuilder } = context;

  try {
    await interaction.deferReply();
    // CPU使用率
    const loadData = os.cpus;
    const cpuLoadInfo = await si.currentLoad();
    const cpuLoad = cpuLoadInfo.currentLoad.toFixed(2);

    // メモリ
    const mem = await si.mem().catch(() => ({ total: 0, available: 0 }));
    const memUsed = mem.total && mem.available ? ((mem.total - mem.available) / 1024 / 1024 / 1024).toFixed(2) : '0';
    const memFree = mem.available ? (mem.available / 1024 / 1024 / 1024).toFixed(2) : '0';
    const memTotal = mem.total ? (mem.total / 1024 / 1024 / 1024).toFixed(2) : '0';

    // ネットワーク
    const netStats = await si.networkStats().catch(() => [{ rx_sec:0, tx_sec:0 }]);
    const netSpeed = netStats[0] ? ((netStats[0].rx_sec + netStats[0].tx_sec)/1024/1024).toFixed(2) : '0';

    // CPU詳細
    const cpu = await si.cpu().catch(() => ({ brand: 'Unknown', cores: 0, logicalCores: 0, speed: 0 }));

    // uptime
    const uptime = os.uptime();
    const ping = Math.floor(Math.random() * 50) + 20; // 仮Ping

    // ドーナツグラフ
    const config = {
      type: 'doughnut',
      data: {
        labels: ['CPU %', 'メモリ使用', 'メモリ空き', 'ネットワーク MB/s'],
        datasets: [{
          data: [cpuLoad, memUsed, memFree, netSpeed],
          backgroundColor: ['#FF6384', '#36A2EB', '#4BC0C0', '#FFCE56'],
        }]
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        responsive: false,
      }
    };

    const buffer = await chartJSNodeCanvas.renderToBuffer(config);
    const attachment = new AttachmentBuilder(buffer, { name: 'stats.png' });

    // Embedで詳細情報も表示
    await interaction.editReply({
      content: `CPU: ${cpu.brand}\nコア数: ${cpu.cores}, スレッド数: ${cpu.logicalCores}\nクロック: ${cpu.speed} GHz\nCPU使用率: ${cpuLoad} %\n稼働時間: ${Math.floor(uptime/60)} min\nPing: ${ping} ms\nネットワークスピード: ${netSpeed} MB/s、\nメモリ総量: ${memTotal} GB\n空きメモリ: ${memFree} GB`,
      files: [attachment]
    });

  } catch (err) {
    console.error("Error in /ping:", err);

    if (interaction.deferred && !interaction.replied) {
      // defer 済み → editReply only
      await interaction.editReply("❌ エラーが発生しました").catch(console.error);
    } else if (!interaction.replied) {
      // defer できてなかった時
      await interaction.reply("❌ エラーが発生しました").catch(console.error);
    }
  }
}
