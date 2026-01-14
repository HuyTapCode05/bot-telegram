// Script test để kiểm tra message log
const fs = require('fs');
const path = require('path');

const MESSAGE_LOG_PATH = path.join(__dirname, 'logs', 'messages.json');

console.log('📊 Phân tích message log...\n');

try {
  const store = JSON.parse(fs.readFileSync(MESSAGE_LOG_PATH, 'utf-8'));
  const keys = Object.keys(store);
  
  console.log(`✅ Tổng số tin nhắn đã log: ${keys.length}`);
  
  // Phân tích theo chatId
  const chatStats = new Map();
  const userStats = new Map();
  
  for (const key of keys) {
    const entry = store[key];
    
    // Đếm theo chat
    const chatId = entry.chatId;
    chatStats.set(chatId, (chatStats.get(chatId) || 0) + 1);
    
    // Đếm theo user
    const userId = entry.userId;
    const userName = [entry.firstName, entry.lastName].filter(Boolean).join(' ') || entry.username || `User ${userId}`;
    userStats.set(userId, {
      name: userName,
      count: (userStats.get(userId)?.count || 0) + 1
    });
  }
  
  console.log(`\n📊 Thống kê theo nhóm:`);
  for (const [chatId, count] of chatStats.entries()) {
    console.log(`   Chat ${chatId}: ${count} tin nhắn`);
  }
  
  console.log(`\n👥 Top 10 người chat nhiều nhất (toàn bộ):`);
  const topUsers = [...userStats.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  
  topUsers.forEach(([userId, data], index) => {
    console.log(`   ${index + 1}. ${data.name}: ${data.count} tin nhắn`);
  });
  
  // Kiểm tra tin nhắn hôm nay
  const now = new Date();
  let todayCount = 0;
  
  for (const key of keys) {
    const entry = store[key];
    const checkTime = entry.savedAt || entry.timestamp;
    if (!checkTime) continue;
    
    let ms = checkTime;
    if (typeof checkTime === 'string') {
      ms = Number(checkTime);
    }
    if (ms < 1e12) ms = ms * 1000;
    
    const d = new Date(ms);
    if (d.getDate() === now.getDate() && 
        d.getMonth() === now.getMonth() && 
        d.getFullYear() === now.getFullYear()) {
      todayCount++;
    }
  }
  
  console.log(`\n📅 Tin nhắn hôm nay: ${todayCount}`);
  
  // Kiểm tra tin nhắn 7 ngày gần đây
  let weekCount = 0;
  for (const key of keys) {
    const entry = store[key];
    const checkTime = entry.savedAt || entry.timestamp;
    if (!checkTime) continue;
    
    let ms = checkTime;
    if (typeof checkTime === 'string') {
      ms = Number(checkTime);
    }
    if (ms < 1e12) ms = ms * 1000;
    
    const d = new Date(ms);
    const diff = now.getTime() - d.getTime();
    if (diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000) {
      weekCount++;
    }
  }
  
  console.log(`📆 Tin nhắn 7 ngày qua: ${weekCount}\n`);
  
} catch (e) {
  console.error('❌ Lỗi:', e.message);
}
