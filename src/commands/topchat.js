const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

const MESSAGE_LOG_PATH = path.join(__dirname, '..', '..', 'logs', 'messages.json');
const TEMP_DIR = path.join(__dirname, '..', '..', 'assets', 'temp');
const RANK_IMAGES_DIR = path.join(__dirname, '..', '..', 'assets', 'ranks');

/**
 * Đọc log tin nhắn
 */
function readMessageLog() {
  try {
    if (!fs.existsSync(MESSAGE_LOG_PATH)) return {};
    return JSON.parse(fs.readFileSync(MESSAGE_LOG_PATH, 'utf-8'));
  } catch (e) {
    console.error('Error reading message log:', e.message);
    return {};
  }
}

/**
 * Ghi log tin nhắn
 */
function writeMessageLog(data) {
  try {
    const logDir = path.dirname(MESSAGE_LOG_PATH);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(MESSAGE_LOG_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing message log:', e.message);
  }
}

/**
 * Log một tin nhắn
 */
function logMessage(ctx) {
  try {
    // Kiểm tra có message không (bao gồm cả text, photo, sticker, etc.)
    if (!ctx.message) return;
    if (!ctx.chat) return;
    if (!ctx.from) return;

    // Chỉ log tin nhắn trong group/supergroup, bỏ qua private chat
    if (ctx.chat.type === 'private') return;

    // Bỏ qua tin nhắn từ bot (không tự đếm tin nhắn của chính mình)
    if (ctx.from.is_bot) return;

    const store = readMessageLog();
    const messageId = ctx.message.message_id;
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const timestamp = ctx.message.date * 1000; // Convert to milliseconds

    const key = `${chatId}_${messageId}`;

    // Kiểm tra xem tin nhắn đã được log chưa để tránh duplicate
    if (store[key]) return;

    store[key] = {
      messageId,
      chatId,
      userId,
      username: ctx.from.username || '',
      firstName: ctx.from.first_name || '',
      lastName: ctx.from.last_name || '',
      timestamp,
      savedAt: Date.now()
    };

    writeMessageLog(store);
  } catch (e) {
    console.error('Error logging message:', e.message);
  }
}

/**
 * Kiểm tra cùng ngày
 */
function isSameDay(ts, now) {
  if (!ts) return false;
  let ms = ts;
  if (typeof ts === 'string') {
    const num = Number(ts);
    if (!isNaN(num)) ms = num;
    else ms = new Date(ts).getTime(); // fallback
  }
  // Nếu là giây (10 chữ số) đổi sang ms
  if (ms < 1e12) ms = ms * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return false;

  // So sánh theo múi giờ địa phương
  return d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
}

/**
 * Kiểm tra trong 7 ngày
 */
function isWithin7Days(ts, now) {
  if (!ts) return false;
  let ms = ts;
  if (typeof ts === 'string') {
    const num = Number(ts);
    if (!isNaN(num)) ms = num;
    else ms = new Date(ts).getTime();
  }
  if (ms < 1e12) ms = ms * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return false;
  const diff = now.getTime() - d.getTime();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

/**
 * Lấy rank badge dựa trên số tin nhắn
 */
function getRankBadge(messageCount) {
  if (messageCount >= 120) return { name: 'Cao Thủ', stars: 1, color: '#FF1493', image: 'cao-thu.png' };
  if (messageCount >= 108) return { name: 'Tinh Anh I', stars: 1, color: '#E8E8E8', image: 'thach-dau.png' };
  if (messageCount >= 65) return { name: 'Kim Cương V', stars: 3, color: '#00CED1', image: 'kim-cuong.png' };
  if (messageCount >= 52) return { name: 'Bạch Kim III', stars: 5, color: '#E5E4E2', image: 'bach-kim.png' };
  if (messageCount >= 44) return { name: 'Bạch Kim IV', stars: 2, color: '#E5E4E2', image: 'bach-kim.png' };
  if (messageCount >= 41) return { name: 'Bạch Kim V', stars: 4, color: '#E5E4E2', image: 'bach-kim.png' };
  if (messageCount >= 35) return { name: 'Vàng I', stars: 2, color: '#FFD700', image: 'vang.png' };
  if (messageCount >= 34) return { name: 'Vàng I', stars: 1, color: '#FFD700', image: 'vang.png' };
  if (messageCount >= 33) return { name: 'Vàng II', stars: 3, color: '#FFD700', image: 'vang.png' };
  if (messageCount >= 20) return { name: 'Bạc I', stars: 3, color: '#C0C0C0', image: 'bac.png' };
  if (messageCount >= 10) return { name: 'Đồng I', stars: 2, color: '#CD7F32', image: 'dong.png' };
  return { name: 'Sắt IV', stars: 0, color: '#808080', image: 'sat.png' };
}

/**
 * Tính số tin nhắn cần để lên rank tiếp theo
 */
function getNextRankThreshold(currentCount) {
  const thresholds = [10, 20, 33, 34, 35, 41, 44, 52, 65, 108, 120];
  for (const threshold of thresholds) {
    if (currentCount < threshold) {
      return {
        threshold,
        remaining: threshold - currentCount
      };
    }
  }
  return null; // Đã đạt rank cao nhất
}

/**
 * Vẽ canvas cho bảng xếp hạng
 */
async function drawTopChatCanvas(topList, nameMap, chatTitle = 'Infinite Coder') {
  const width = 768;
  const height = 120 + (topList.length * 90) + 80; // Header + entries + footer

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🏆 BẢNG XẾP HẠNG TƯƠNG TÁC 🏆', width / 2, 50);

  ctx.fillStyle = '#FFA500';
  ctx.font = 'bold 24px Arial';
  ctx.fillText(`⚜️ ${chatTitle} ⚜️`, width / 2, 90);

  // Separator line
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 110);
  ctx.lineTo(width - 40, 110);
  ctx.stroke();

  // Draw each entry
  let y = 150;
  for (let i = 0; i < topList.length; i++) {
    const [uid, count] = topList[i];
    const name = nameMap.get(uid) || 'Unknown';
    const rank = getRankBadge(count);

    // Entry background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(30, y - 35, width - 60, 80);

    // Rank number
    const medals = ['🥇', '🥈', '🥉'];
    const rankText = i < 3 ? medals[i] : `#${i + 1}`;
    ctx.fillStyle = i < 3 ? '#FFD700' : '#FFFFFF';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(rankText, 50, y);

    // Name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(name, 120, y);

    // Message count
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '18px Arial';
    ctx.fillText(`💬 ${count} tin nhắn`, 120, y + 25);

    // Load and draw rank image
    try {
      const rankImagePath = path.join(RANK_IMAGES_DIR, rank.image);
      const rankImg = await loadImage(rankImagePath);
      ctx.drawImage(rankImg, width - 200, y - 30, 60, 60);
    } catch (e) {
      console.error('Error loading rank image:', e.message);
    }

    // Rank name
    ctx.fillStyle = rank.color;
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(rank.name, width - 50, y - 5);

    // Draw stars using emoji (same as reference image)
    let starText = '';
    for (let s = 0; s < 5; s++) {
      starText += s < rank.stars ? '⭐' : '☆';
    }
    ctx.fillStyle = '#FFD700';
    ctx.font = '14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(starText, width - 50, y + 18);

    y += 90;
  }

  // Footer
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, y);
  ctx.lineTo(width - 40, y);
  ctx.stroke();

  const now = new Date();
  const dateStr = `${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ${now.toLocaleDateString('vi-VN')}`;
  ctx.fillStyle = '#AAAAAA';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`📅 Cập nhật: ${dateStr}`, width / 2, y + 35);

  return canvas;
}

/**
 * Vẽ canvas cho thống kê cá nhân
 */
async function drawPersonalStatsCanvas(userName, count, rank, myRank, totalUsers, nextRank) {
  const width = 720;
  const height = 420;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background with border
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Golden border
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Title
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🎯 Tương Tác Hôm Nay', width / 2, 70);

  // Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px Arial';
  ctx.fillText(userName, width / 2, 130);

  // Message count
  ctx.fillStyle = '#AAAAAA';
  ctx.font = '24px Arial';
  ctx.fillText(`💬 ${count} tin nhắn trong hôm nay`, width / 2, 170);

  // Load and draw rank image (centered)
  const rankBadge = getRankBadge(count);
  try {
    const rankImagePath = path.join(RANK_IMAGES_DIR, rankBadge.image);
    const rankImg = await loadImage(rankImagePath);
    ctx.drawImage(rankImg, (width - 80) / 2, 185, 80, 80);
  } catch (e) {
    console.error('Error loading rank image:', e.message);
  }

  // Rank badge name
  ctx.fillStyle = rankBadge.color;
  ctx.font = 'bold 28px Arial';
  ctx.fillText(rankBadge.name, width / 2, 290);

  // Draw stars using emoji
  let starText = '';
  for (let s = 0; s < 5; s++) {
    starText += s < rankBadge.stars ? '⭐' : '☆';
  }
  ctx.fillStyle = '#FFD700';
  ctx.font = '20px Arial';
  ctx.fillText(starText, width / 2, 318);

  // Ranking
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px Arial';
  ctx.fillText(`🏅 Xếp hạng: #${myRank}/${totalUsers}`, width / 2, 350);

  // Next rank info
  if (nextRank) {
    ctx.fillStyle = '#FFD700';
    ctx.font = '20px Arial';
    ctx.fillText(`✨ Còn ${nextRank.remaining} tin nhắn nữa để lên bậc`, width / 2, 385);
  }

  return canvas;
}

/**
 * Command /topchat
 */
async function topChatCommand(ctx) {
  try {
    const text = (ctx.message && ctx.message.text) || '';
    const parts = text.trim().split(/\s+/);
    const mode = parts[1] ? parts[1].toLowerCase() : 'today'; // Đổi mặc định từ 'week' sang 'today'

    const chatId = ctx.chat.id;
    const chatType = ctx.chat.type;

    // Chỉ hoạt động trong group
    if (chatType === 'private') {
      return ctx.reply('⚠️ Lệnh này chỉ hoạt động trong nhóm!');
    }

    const now = new Date();
    const store = readMessageLog();

    // Aggregate by user
    const counter = new Map();
    const nameMap = new Map();
    const myUserId = ctx.from.id;

    for (const key of Object.keys(store)) {
      const entry = store[key];
      if (!entry) continue;
      if (!entry.userId) continue;
      if (!entry.chatId) continue;
      if (entry.chatId !== chatId) continue;

      // Ưu tiên dùng savedAt vì nó chính xác hơn
      const checkTime = entry.savedAt || entry.timestamp;
      if (!checkTime) continue;

      let dayMatch = false;
      if (mode === 'today') {
        // Chỉ đếm hôm nay
        dayMatch = isSameDay(checkTime, now);
      } else if (mode === 'week') {
        // Chỉ đếm 7 ngày
        dayMatch = isWithin7Days(checkTime, now);
      } else {
        // Default: đếm TẤT CẢ tin nhắn từ trước đến giờ
        dayMatch = true;
      }

      if (!dayMatch) continue;

      const uid = entry.userId;
      counter.set(uid, (counter.get(uid) || 0) + 1);
      const displayName = [entry.firstName, entry.lastName].filter(Boolean).join(' ') || entry.username || `User ${uid}`;
      nameMap.set(uid, displayName);
    }

    if (counter.size === 0) {
      const period = mode === 'today' ? 'hôm nay' : mode === 'week' ? '7 ngày qua' : 'từ trước đến giờ';
      return ctx.reply(`📊 Chưa có dữ liệu tương tác ${period} trong nhóm này.`);
    }

    // Mode: me (chỉ hiển thị thông tin cá nhân)
    if (mode === 'me') {
      const myCount = counter.get(myUserId) || 0;
      if (myCount === 0) {
        return ctx.reply('❌ Bạn chưa có tin nhắn nào trong khoảng thời gian này!');
      }

      const sorted = [...counter.entries()].sort((a, b) => b[1] - a[1]);
      const myRank = sorted.findIndex(([uid]) => uid === myUserId) + 1;
      const myName = nameMap.get(myUserId) || 'Unknown';
      const nextRank = getNextRankThreshold(myCount);

      // Generate canvas image
      try {
        const canvas = await drawPersonalStatsCanvas(myName, myCount, getRankBadge(myCount), myRank, counter.size, nextRank);

        // Save to temp file
        if (!fs.existsSync(TEMP_DIR)) {
          fs.mkdirSync(TEMP_DIR, { recursive: true });
        }
        const tempFile = path.join(TEMP_DIR, `topchat_me_${Date.now()}.png`);
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(tempFile, buffer);

        // Send image
        await ctx.replyWithPhoto({ source: fs.createReadStream(tempFile) });

        // Delete temp file
        try {
          fs.unlinkSync(tempFile);
        } catch (e) { }

        return;
      } catch (err) {
        console.error('Canvas error:', err);
        return ctx.reply('❌ Không thể tạo ảnh thống kê. Vui lòng thử lại sau.');
      }
    }

    // Mode: today hoặc week (hiển thị top 10)
    const topList = [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Get chat title
    const chatTitle = ctx.chat.title || 'Infinite Coder';

    // Generate canvas image
    try {
      const canvas = await drawTopChatCanvas(topList, nameMap, chatTitle);

      // Save to temp file
      if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
      }
      const tempFile = path.join(TEMP_DIR, `topchat_${Date.now()}.png`);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(tempFile, buffer);

      // Send image
      await ctx.replyWithPhoto({ source: fs.createReadStream(tempFile) });

      // Delete temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (e) { }

      return;
    } catch (err) {
      console.error('Canvas error:', err);
      return ctx.reply('❌ Không thể tạo ảnh thống kê. Vui lòng thử lại sau.');
    }

  } catch (error) {
    console.error('topChatCommand error:', error.message);
    return ctx.reply('❌ Đã xảy ra lỗi khi thống kê. Vui lòng thử lại sau.');
  }
}

module.exports = {
  name: 'topchat',
  description: 'Thống kê chat nhóm',
  handler: topChatCommand,
  // Exports thêm cho middleware logger
  logMessage,
  readMessageLog,
  writeMessageLog
};

