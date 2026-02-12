const fs = require('fs');
const path = require('path');

const MESSAGE_LOG_PATH = path.join(__dirname, 'logs', 'messages.json');

function isSameDay(ts, now) {
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
  
  return d.getDate() === now.getDate() && 
         d.getMonth() === now.getMonth() && 
         d.getFullYear() === now.getFullYear();
}

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

console.log('📊 Mô phỏng kết quả lệnh /topchat\n');

const store = JSON.parse(fs.readFileSync(MESSAGE_LOG_PATH, 'utf-8'));
const now = new Date();
const chatId = -4768877502; // Chat ID từ log

// Test cả 3 mode
['week', 'today', 'all'].forEach(mode => {
  const counter = new Map();
  const nameMap = new Map();
  
  for (const key of Object.keys(store)) {
    const entry = store[key];
    if (!entry) continue;
    if (!entry.userId) continue;
    if (!entry.chatId) continue;
    if (entry.chatId !== chatId) continue;
    
    const checkTime = entry.savedAt || entry.timestamp;
    if (!checkTime) continue;
    
    let dayMatch = false;
    if (mode === 'today') {
      dayMatch = isSameDay(checkTime, now);
    } else if (mode === 'week') {
      dayMatch = isWithin7Days(checkTime, now);
    } else {
      dayMatch = true;
    }
    
    if (!dayMatch) continue;
    
    const uid = entry.userId;
    counter.set(uid, (counter.get(uid) || 0) + 1);
    const displayName = [entry.firstName, entry.lastName].filter(Boolean).join(' ') || entry.username || `User ${uid}`;
    nameMap.set(uid, displayName);
  }
  
  const topList = [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  
  console.log(`\n🏆 /topchat ${mode === 'all' ? '(không tham số = week)' : mode}`);
  console.log('─'.repeat(50));
  topList.forEach(([uid, count], index) => {
    const name = nameMap.get(uid);
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
    console.log(`${medal} ${name}: ${count} tin nhắn`);
  });
});

console.log('\n💡 Lưu ý:');
console.log('   - Gõ /topchat (không tham số) = /topchat week (7 ngày)');
console.log('   - Gõ /topchat today để xem HÔM NAY');
console.log('   - Gõ /topchat me để xem thống kê cá nhân\n');
