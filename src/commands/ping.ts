import os from 'node:os';
import { AttachmentBuilder } from 'discord.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import si from 'systeminformation';
import type { Command } from './index.js';

const chart = new ChartJSNodeCanvas({ width: 400, height: 400 });
const GB = 1_024 ** 3;

export default {
	data: {
		name: 'ping',
		description: 'サーバーへの接続とリソースを表示します。',
	},
	async execute(interaction) {
		await interaction.deferReply();

		const [load, mem, network, cpu] = await Promise.all([si.currentLoad(), si.mem(), si.networkStats(), si.cpu()]);

		const cpuLoad = Number(load.currentLoad.toFixed(2));
		const memUsed = Number(((mem.total - mem.available) / GB).toFixed(2));
		const memFree = Number((mem.available / GB).toFixed(2));
		const memTotal = Number((mem.total / GB).toFixed(2));
		const netSpeed = Number((((network[0]?.rx_sec ?? 0) + (network[0]?.tx_sec ?? 0)) / 1_024 / 1_024).toFixed(2));

		const image = await chart.renderToBuffer({
			type: 'doughnut',
			data: {
				labels: ['CPU %', 'メモリ使用', 'メモリ空き', 'ネットワーク MB/s'],
				datasets: [
					{
						data: [cpuLoad, memUsed, memFree, netSpeed],
						backgroundColor: ['#FF6384', '#36A2EB', '#4BC0C0', '#FFCE56'],
					},
				],
			},
			options: { plugins: { legend: { position: 'bottom' } }, responsive: false },
		});

		await interaction.editReply({
			content: [
				`CPU: ${cpu.brand}`,
				`コア数: ${cpu.physicalCores}, スレッド数: ${cpu.cores}`,
				`クロック: ${cpu.speed} GHz`,
				`CPU使用率: ${cpuLoad} %`,
				`稼働時間: ${Math.floor(os.uptime() / 60)} min`,
				`Ping: ${Math.round(interaction.client.ws.ping)} ms`,
				`ネットワークスピード: ${netSpeed} MB/s`,
				`メモリ総量: ${memTotal} GB`,
				`空きメモリ: ${memFree} GB`,
			].join('\n'),
			files: [new AttachmentBuilder(image, { name: 'stats.png' })],
		});
	},
} satisfies Command;
