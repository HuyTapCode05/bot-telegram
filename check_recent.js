const fs = require('fs');
const path = require('path');

const MESSAGE_LOG_PATH = path.join(__dirname, 'logs', 'messages.json');

const data = JSON.parse(fs.readFileSync(MESSAGE_LOG_PATH, 'utf-8'));
const entries = Object.entries(data).slice(-15);

console.log('📝 15 tin nhắn mới nhất:\n');

entries.forEach(([key, val]) => {
  const d = new Date(val.savedAt || val.timestamp);
  const time = d.toLocaleTimeString('vi-VN');
  const name = `${val.firstName} ${val.lastName || ''}`.trim();
  console.log(`${time} - ${name}: message #${val.messageId}`);
});
