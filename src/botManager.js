const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const errorHandler = require('./middlewares/errorHandler');
const messageLogger = require('./middlewares/logger');
const botStateCheck = require('./middlewares/botStateCheck');
const loadCommands = require('./loader');
const { registerCallbackHandler } = require('./handlers/callbackQuery');
const { registerMessageHandler } = require('./handlers/messageReply');

const BOTS_FILE = path.join(__dirname, '../config/bots.json');
const bots = new Map(); // botId -> { instance, info, status }

// ── Đảm bảo file bots.json tồn tại ──
function ensureBotsFile() {
  const configDir = path.dirname(BOTS_FILE);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  if (!fs.existsSync(BOTS_FILE)) {
    fs.writeFileSync(BOTS_FILE, JSON.stringify([], null, 2));
  }
}

// ── Đọc danh sách bots từ file ──
function loadBotsFromFile() {
  try {
    ensureBotsFile();
    const data = fs.readFileSync(BOTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading bots file:', error);
    return [];
  }
}

// ── Lưu danh sách bots vào file ──
function saveBotsToFile(botsList) {
  try {
    ensureBotsFile();
    fs.writeFileSync(BOTS_FILE, JSON.stringify(botsList, null, 2));
  } catch (error) {
    console.error('Error saving bots file:', error);
    throw error;
  }
}

// ── Tạo bot instance mới ──
function createBotInstance(token, botInfo = {}) {
  const bot = new Telegraf(token);
  
  // ── Middleware (thứ tự quan trọng) ──
  bot.use(errorHandler());
  bot.use(messageLogger());
  bot.use(botStateCheck());
  
  // ── Auto-load commands ──
  loadCommands(bot);
  
  // ── Đăng ký thêm commands không theo convention ──
  const { handleGetVoiceCommand } = require('./commands/music/voice');
  bot.command('getvoice', handleGetVoiceCommand);
  
  const sclCommand = require('./commands/music/scl');
  bot.command('scl', sclCommand);
  
  // ── Handlers ──
  registerCallbackHandler(bot);
  registerMessageHandler(bot);
  
  return bot;
}

// ── Thêm bot mới ──
async function addBot(token, name = null) {
  try {
    // Validate token bằng cách lấy thông tin bot
    const tempBot = new Telegraf(token);
    const botInfo = await tempBot.telegram.getMe();
    tempBot.stop('SIGTERM');
    
    const botId = botInfo.id.toString();
    const botName = name || botInfo.first_name || `Bot ${botId}`;
    
    // Kiểm tra bot đã tồn tại chưa
    const botsList = loadBotsFromFile();
    if (botsList.find(b => b.id === botId)) {
      throw new Error('Bot đã tồn tại');
    }
    
    // Tạo bot instance
    const botInstance = createBotInstance(token);
    
    // Lưu thông tin bot
    const botData = {
      id: botId,
      token: token,
      name: botName,
      username: botInfo.username || null,
      createdAt: new Date().toISOString(),
      status: 'stopped'
    };
    
    botsList.push(botData);
    saveBotsToFile(botsList);
    
    // Lưu vào memory
    bots.set(botId, {
      instance: botInstance,
      info: botData,
      status: 'stopped'
    });
    
    return botData;
  } catch (error) {
    console.error('Error adding bot:', error);
    throw error;
  }
}

// ── Khởi động bot ──
async function startBot(botId) {
  try {
    let botData = bots.get(botId);
    if (!botData) {
      // Load từ file nếu chưa có trong memory
      const botsList = loadBotsFromFile();
      const botInfo = botsList.find(b => b.id === botId);
      if (!botInfo) {
        throw new Error('Bot không tồn tại');
      }
      
      // Tạo instance
      const botInstance = createBotInstance(botInfo.token);
      bots.set(botId, {
        instance: botInstance,
        info: botInfo,
        status: 'starting'
      });
      botData = bots.get(botId);
    }
    
    if (botData.status === 'running') {
      return { success: true, message: 'Bot đã đang chạy' };
    }
    
    // Launch bot
    await botData.instance.launch();
    botData.status = 'running';
    
    // Cập nhật file
    const botsList = loadBotsFromFile();
    const botIndex = botsList.findIndex(b => b.id === botId);
    if (botIndex !== -1) {
      botsList[botIndex].status = 'running';
      saveBotsToFile(botsList);
    }
    
    console.log(`✅ Bot ${botId} đã khởi động`);
    return { success: true, message: 'Bot đã khởi động thành công' };
  } catch (error) {
    console.error(`Error starting bot ${botId}:`, error);
    throw error;
  }
}

// ── Dừng bot ──
async function stopBot(botId) {
  try {
    const botData = bots.get(botId);
    if (!botData) {
      throw new Error('Bot không tồn tại trong memory');
    }
    
    if (botData.status === 'stopped') {
      return { success: true, message: 'Bot đã dừng' };
    }
    
    // Stop bot
    await botData.instance.stop('SIGTERM');
    botData.status = 'stopped';
    
    // Cập nhật file
    const botsList = loadBotsFromFile();
    const botIndex = botsList.findIndex(b => b.id === botId);
    if (botIndex !== -1) {
      botsList[botIndex].status = 'stopped';
      saveBotsToFile(botsList);
    }
    
    console.log(`⏹️ Bot ${botId} đã dừng`);
    return { success: true, message: 'Bot đã dừng thành công' };
  } catch (error) {
    console.error(`Error stopping bot ${botId}:`, error);
    throw error;
  }
}

// ── Xóa bot ──
async function deleteBot(botId) {
  try {
    // Stop bot nếu đang chạy
    if (bots.has(botId) && bots.get(botId).status === 'running') {
      await stopBot(botId);
    }
    
    // Xóa khỏi memory
    bots.delete(botId);
    
    // Xóa khỏi file
    const botsList = loadBotsFromFile();
    const filteredBots = botsList.filter(b => b.id !== botId);
    saveBotsToFile(filteredBots);
    
    console.log(`🗑️ Bot ${botId} đã bị xóa`);
    return { success: true, message: 'Bot đã bị xóa thành công' };
  } catch (error) {
    console.error(`Error deleting bot ${botId}:`, error);
    throw error;
  }
}

// ── Lấy danh sách bots ──
function getAllBots() {
  const botsList = loadBotsFromFile();
  return botsList.map(bot => {
    const inMemory = bots.get(bot.id);
    return {
      ...bot,
      status: inMemory ? inMemory.status : bot.status || 'stopped'
    };
  });
}

// ── Lấy thông tin bot ──
function getBot(botId) {
  const botsList = loadBotsFromFile();
  const botInfo = botsList.find(b => b.id === botId);
  if (!botInfo) {
    return null;
  }
  
  const inMemory = bots.get(botId);
  return {
    ...botInfo,
    status: inMemory ? inMemory.status : botInfo.status || 'stopped',
    instance: inMemory ? inMemory.instance : null
  };
}

// ── Khởi động lại tất cả bots đã lưu (khi server restart) ──
async function restoreBots() {
  try {
    const botsList = loadBotsFromFile();
    console.log(`📦 Khôi phục ${botsList.length} bot(s)...`);
    
    for (const botInfo of botsList) {
      try {
        if (botInfo.status === 'running') {
          // Tạo instance và start
          const botInstance = createBotInstance(botInfo.token);
          await botInstance.launch();
          
          bots.set(botInfo.id, {
            instance: botInstance,
            info: botInfo,
            status: 'running'
          });
          
          console.log(`✅ Đã khôi phục bot ${botInfo.id} (${botInfo.name})`);
        } else {
          // Chỉ tạo instance, không start
          const botInstance = createBotInstance(botInfo.token);
          bots.set(botInfo.id, {
            instance: botInstance,
            info: botInfo,
            status: 'stopped'
          });
        }
      } catch (error) {
        console.error(`❌ Lỗi khôi phục bot ${botInfo.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error restoring bots:', error);
  }
}

module.exports = {
  addBot,
  startBot,
  stopBot,
  deleteBot,
  getAllBots,
  getBot,
  restoreBots,
  bots // Export để có thể truy cập trực tiếp nếu cần
};

