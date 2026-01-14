const fs = require('fs');
const path = require('path');

const MESSAGE_LOG_PATH = path.join(__dirname, 'logs', 'messages.json');

console.log('🔍 Phân tích chi tiết tin nhắn theo thời gian...\n');

const data = JSON.parse(fs.readFileSync(MESSAGE_LOG_PATH, 'utf-8'));
const entries = Object.entries(data);

// Group by time period
const today = new Date();
const todayMessages = [];
const weekMessages = [];
const olderMessages = [];

entries.forEach(([key, val]) => {
  const checkTime = val.savedAt || val.timestamp;
  let ms = checkTime;
  if (typeof checkTime === 'string') {
    ms = Number(checkTime);
  }
  if (ms < 1e12) ms = ms * 1000;
  
  const d = new Date(ms);
  const diff = today.getTime() - d.getTime();
  
  // Check if same day
  const isSameDay = d.getDate() === today.getDate() && 
                    d.getMonth() === today.getMonth() && 
                    d.getFullYear() === today.getFullYear();
  
  // Check if within 7 days
  const isWithin7Days = diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  
  if (isSameDay) {
    todayMessages.push({ ...val, time: d });
  } else if (isWithin7Days) {
    weekMessages.push({ ...val, time: d });
  } else {
    olderMessages.push({ ...val, time: d });
  }
});

console.log(`📅 Hôm nay (${today.toLocaleDateString('vi-VN')}): ${todayMessages.length} tin nhắn`);
console.log(`📆 7 ngày qua: ${weekMessages.length + todayMessages.length} tin nhắn`);
console.log(`📜 Cũ hơn 7 ngày: ${olderMessages.length} tin nhắn\n`);

// Show today's messages by user
if (todayMessages.length > 0) {
  console.log('👥 Thống kê HÔM NAY theo user:');
  const userCount = new Map();
  todayMessages.forEach(msg => {
    const name = `${msg.firstName} ${msg.lastName || ''}`.trim();
    userCount.set(msg.userId, {
      name: name || msg.username || `User ${msg.userId}`,
      count: (userCount.get(msg.userId)?.count || 0) + 1
    });
  });
  
  const sorted = [...userCount.entries()]
    .sort((a, b) => b[1].count - a[1].count);
  
  sorted.forEach(([userId, data]) => {
    console.log(`   ${data.name}: ${data.count} tin nhắn`);
  });
}

// Show message IDs to check for gaps
console.log('\n📊 Message IDs hôm nay (check xem có bị thiếu không):');
const messageIds = todayMessages.map(m => m.messageId).sort((a, b) => a - b);
if (messageIds.length > 0) {
  console.log(`   Từ #${messageIds[0]} đến #${messageIds[messageIds.length - 1]}`);
  console.log(`   Tổng cộng: ${messageIds.length} tin`);
  
  // Check for gaps
  const gaps = [];
  for (let i = 1; i < messageIds.length; i++) {
    const diff = messageIds[i] - messageIds[i-1];
    if (diff > 1) {
      gaps.push(`   Thiếu ${diff - 1} tin từ #${messageIds[i-1]} đến #${messageIds[i]}`);
    }
  }
  
  if (gaps.length > 0) {
    console.log('\n⚠️  Phát hiện khoảng trống (tin nhắn không được log):');
    gaps.forEach(g => console.log(g));
    console.log('\n💡 Nguyên nhân có thể:');
    console.log('   - Tin nhắn được gửi khi bot chưa chạy/đã tắt');
    console.log('   - Tin nhắn từ bot (bot không log tin nhắn của chính nó)');
    console.log('   - Lỗi trong quá trình log');
  }
}
