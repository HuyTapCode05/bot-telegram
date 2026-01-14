const fs = require('fs');
const path = require('path');
let createCanvas, loadImage;
try {
  const canvasPkg = require('canvas');
  createCanvas = canvasPkg.createCanvas;
  loadImage = canvasPkg.loadImage;
} catch (e) {
  createCanvas = null;
  loadImage = null;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

async function createGroupInfoImage(groupInfo, owner) {
  if (!createCanvas) throw new Error('canvas-not-installed');
  const width = 1000;
  const height = 520;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // background
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, width, height);

  // title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px Sans';
  ctx.fillText('Thông tin nhóm', 40, 60);

  // group box
  ctx.fillStyle = '#0f1724';
  ctx.fillRect(40, 80, width - 80, 140);
  ctx.fillStyle = '#fff';
  ctx.font = '28px Sans';
  const title = String(groupInfo.name || 'Không tên nhóm');
  ctx.fillText(title, 60, 120);
  ctx.font = '16px Sans';
  ctx.fillStyle = '#9aa4b2';
  const desc = String(groupInfo.desc || 'Không có mô tả');
  wrapText(ctx, desc, 60, 150, width - 140, 20);

  // stats
  ctx.fillStyle = '#fff';
  ctx.font = '18px Sans';
  ctx.fillText(`Số thành viên: ${groupInfo.memberCount || 'N/A'}`, 60, 240);
  ctx.fillText(`ID: ${groupInfo.groupId || groupInfo.chatId || ''}`, 60, 270);
  ctx.fillText(`Chủ nhóm: ${owner ? (owner.username ? '@' + owner.username : `${owner.first_name || ''} ${owner.last_name || ''}`) : 'N/A'}`, 60, 300);

  // admins
  ctx.fillStyle = '#cfe6ff';
  ctx.font = '16px Sans';
  ctx.fillText('Admins:', 60, 340);
  ctx.fillStyle = '#fff';
  ctx.font = '14px Sans';
  const admins = groupInfo.admins || [];
  for (let i = 0; i < Math.min(admins.length, 8); i++) {
    const a = admins[i];
    const name = typeof a === 'string' ? a : (a && (a.username ? '@' + a.username : `${a.first_name || ''} ${a.last_name || ''}`)) || '';
    ctx.fillText(`${i + 1}. ${name}`, 80, 370 + i * 22);
  }

  ctx.fillStyle = '#6b7280';
  ctx.font = '12px Sans';
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 40, height - 20);

  const tmpDir = path.join(__dirname, '..', '..', 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, `groupinfo_${Date.now()}.png`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

function clearImagePath(p) { try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {} }

module.exports = { createGroupInfoImage, clearImagePath, hasCanvas: !!createCanvas };
// create user info image (format similar to sample requested)
async function createUserInfoImage(userInfo, viewers = []) {
  if (!createCanvas) throw new Error('canvas-not-installed');
  const width = 820;
  const height = 420;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // background
  ctx.fillStyle = '#071029';
  ctx.fillRect(0, 0, width, height);

  // title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px Sans';
  ctx.fillText('👤 Thông tin người dùng:', 40, 48);

  // left column labels and values
  const labels = [
    { emoji: '🆔', label: 'ID', key: 'uid' },
    { emoji: '👤', label: 'Tên', key: 'firstName' },
    { emoji: '📝', label: 'Họ', key: 'lastName' },
    { emoji: '🔗', label: 'Username', key: 'username' },
    { emoji: '📞', label: 'SĐT', key: 'phone' },
    { emoji: '🌐', label: 'Ngôn ngữ', key: 'language' },
    { emoji: '🖥️', label: 'Thiết bị', key: 'device' },
    { emoji: '🤖', label: 'Bot', key: 'isBot' },
    { emoji: '✅', label: 'Premium', key: 'premium' }
  ];

  ctx.font = '16px Sans';
  ctx.fillStyle = '#dbe7ff';
  let y = 90;
  for (const item of labels) {
    const key = item.key;
    let val = userInfo[key];
    if (key === 'isBot') val = val ? 'Có' : 'Không';
    if (key === 'premium') val = val ? 'Có' : 'Không';
    if (val === undefined || val === null || val === '') val = (key === 'phone' ? 'Không có' : 'Không có');
    const text = `${item.emoji} ${item.label}: ${val}`;
    ctx.fillText(text, 48, y);
    y += 30;
  }

  // small avatar on right
  try {
    if (userInfo.avatar && loadImage) {
      const img = await loadImage(userInfo.avatar);
      const aw = 130, ah = 130;
      const ax = width - aw - 40, ay = 60;
      // draw circle mask
      const cx = ax + aw / 2, cy = ay + ah / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, aw / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, ax, ay, aw, ah);
      ctx.restore();
    }
  } catch (e) {}

  ctx.fillStyle = '#6b7280';
  ctx.font = '12px Sans';
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 48, height - 24);

  // render viewers if provided
  try {
    if (Array.isArray(viewers) && viewers.length > 0) {
      ctx.fillStyle = '#cfe6ff';
      ctx.font = '14px Sans';
      ctx.fillText('👀 Người xem:', 48, height - 60);
      ctx.fillStyle = '#fff';
      ctx.font = '13px Sans';
      const max = 6;
      const list = viewers.slice(0, max);
      let vx = 48 + 110; // indent
      let vy = height - 60;
      for (let i = 0; i < list.length; i++) {
        const t = String(list[i] || '').trim();
        ctx.fillText((i === 0 ? '' : ', ') + t, vx + i * 0, vy);
        vy += 18 * 0; // keep in same line
      }
    }
  } catch (e) {}

  const tmpDir = path.join(__dirname, '..', '..', 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, `userinfo_${Date.now()}.png`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

module.exports.createUserInfoImage = createUserInfoImage;

// Create bot info image (for group chat)
async function createBotInfoImage(botInfo, uptime, totalUptime, botStats, onConfigs = [], offConfigs = []) {
  if (!createCanvas) throw new Error('canvas-not-installed');
  const width = 1000;
  const height = 560;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // background
  ctx.fillStyle = '#071029';
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px Sans';
  ctx.fillText('🔍 Thông tin Bot', 40, 48);

  // Left: avatar + basic
  try {
    if (botInfo && botInfo.avatar && loadImage) {
      const img = await loadImage(botInfo.avatar);
      const aw = 140, ah = 140;
      const ax = 40, ay = 70;
      // circle mask
      const cx = ax + aw / 2, cy = ay + ah / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, aw / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, ax, ay, aw, ah);
      ctx.restore();
    }
  } catch (e) {}

  ctx.fillStyle = '#dbe7ff';
  ctx.font = 'bold 20px Sans';
  const botName = (botInfo && (botInfo.displayName || botInfo.name || botInfo.username)) || 'Bot';
  ctx.fillText(botName, 200, 110);
  ctx.font = '14px Sans';
  ctx.fillStyle = '#9aa4b2';
  ctx.fillText(`Uptime: ${uptime}`, 200, 136);
  ctx.fillText(`Total uptime: ${totalUptime}`, 200, 156);

  // Right: stats box
  const boxX = 40;
  const boxY = 230;
  const boxW = width - 80;
  const boxH = 280;
  // box background
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.fillRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px Sans';
  ctx.fillText('📊 Thống kê hệ thống', boxX + 16, boxY + 28);

  ctx.font = '14px Sans';
  ctx.fillStyle = '#dbe7ff';
  const lines = [
    `Phiên bản: ${botStats.version || 'N/A'}`,
    `Hệ điều hành: ${botStats.os || 'N/A'}`,
    `CPU: ${botStats.cpu || 'N/A'}`,
    `RAM: ${botStats.ram || 'N/A'}`,
    `Disk: ${botStats.disk || 'N/A'}`
  ];
  let ly = boxY + 60;
  for (const l of lines) {
    ctx.fillText(l, boxX + 24, ly);
    ly += 24;
  }

  // Configs lists
  ctx.fillStyle = '#cfe6ff';
  ctx.font = 'bold 16px Sans';
  ctx.fillText('✅ Bật', boxX + boxW - 220, boxY + 28);
  ctx.fillText('❌ Tắt', boxX + boxW - 110, boxY + 28);

  ctx.font = '14px Sans';
  let onY = boxY + 60;
  for (let i = 0; i < Math.min(onConfigs.length, 8); i++) {
    ctx.fillStyle = '#9ee6a6';
    ctx.fillText(onConfigs[i], boxX + boxW - 220, onY + i * 20);
  }
  for (let i = 0; i < Math.min(offConfigs.length, 8); i++) {
    ctx.fillStyle = '#ffb3b3';
    ctx.fillText(offConfigs[i], boxX + boxW - 110, onY + i * 20);
  }

  // footer generated
  ctx.fillStyle = '#6b7280';
  ctx.font = '12px Sans';
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 40, height - 20);

  const tmpDir = path.join(__dirname, '..', '..', 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const outPath = path.join(tmpDir, `botinfo_${Date.now()}.png`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

// Create bot info image for direct/group summary (smaller)
async function createBotInfoImageGroup(botInfo, uptime, totalUptime, botStats) {
  // reuse createBotInfoImage but with narrower layout
  return createBotInfoImage(botInfo, uptime, totalUptime, botStats, [], []);
}

module.exports.createBotInfoImage = createBotInfoImage;
module.exports.createBotInfoImageGroup = createBotInfoImageGroup;
