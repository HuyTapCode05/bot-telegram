const os = require('os');
const fs = require('fs');
const path = require('path');
const canvasUtil = require('../utils/canvas');

function formatTime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days} ngày, ${hours} giờ, ${minutes} phút, ${secs} giây`;
}

function getMemoryUsage() {
  const usedMem = process.memoryUsage().heapUsed;
  return `${Math.round((usedMem / 1024 / 1024) * 100) / 100} MB`;
}

function getPackageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    return pkg.version || 'Không xác định';
  } catch (e) {
    return 'Không xác định';
  }
}

module.exports = async function detailCommand(ctx) {
  try {
    const uptimeSec = process.uptime();
    const uptime = formatTime(uptimeSec);
    const memUsed = getMemoryUsage();
    const cpus = os.cpus() || [];
    const cpuModel = cpus[0] ? cpus[0].model : 'N/A';
    const cpuCores = cpus.length;
    const platform = `${os.type()} ${os.release()}`;
    const nodeVer = process.version;
    const botVersion = getPackageVersion();

    const text = [
      `🤖 Thông tin Bot`,
      `• Phiên bản: ${botVersion}`,
      `• Node: ${nodeVer}`,
      `• Hệ điều hành: ${platform}`,
      `• CPU: ${cpuCores} cores - ${cpuModel}`,
      `• RAM đang dùng: ${memUsed}`,
      `• Thời gian hoạt động: ${uptime}`,
      ``,
      `Ghi chú: nếu bạn cần báo cáo chi tiết (nhiệt độ CPU, disk, network) hãy chạy lệnh /detail full (nếu bot có quyền).`
    ].join('\n');

    // If canvas is available generate an image, otherwise send text
    if (canvasUtil && canvasUtil.hasCanvas) {
      try {
        const botStats = {
          version: botVersion,
          os: platform,
          cpu: `${cpuCores} Cores`,
          ram: memUsed,
          disk: 'N/A'
        };
        const imagePath = await canvasUtil.createBotInfoImage({ displayName: ctx.botInfoName || 'Bot' }, uptime, 'N/A', botStats, [], []);
        await ctx.replyWithPhoto({ source: fs.createReadStream(imagePath) });
        try { canvasUtil.clearImagePath(imagePath); } catch (e) {}
        return;
      } catch (e) {
        console.error('createBotInfoImage error', e && e.message);
      }
    }

    await ctx.reply(text);
  } catch (e) {
    console.error('detail command error', e && e.message);
    try { await ctx.reply('Đã xảy ra lỗi khi lấy thông tin.'); } catch (e) {}
  }
};
