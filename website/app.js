const express = require('express');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

// Try to load bot, but handle errors gracefully
let bot = null;
let botState = null;
let readMessageLog = null;
let botManager = null;

try {
  bot = require('../src/bot');
  botState = require('../src/config/botState');
  readMessageLog = require('../src/commands/topchat').readMessageLog;
} catch (error) {
  console.warn('⚠️  Warning: Could not load bot modules:', error.message);
}

try {
  botManager = require('../src/botManager');
} catch (error) {
  console.warn('⚠️  Warning: Could not load botManager:', error.message);
}

const app = express();
const PORT = process.env.WEB_PORT || 3000;
let io = null;

function emitBotsUpdate() {
  try {
    if (io) io.emit('bots:update');
  } catch (e) {
    // ignore
  }
}

function attachRealtime(server) {
  io = new Server(server, {
    cors: { origin: true, credentials: true }
  });

  io.on('connection', (socket) => {
    socket.emit('bots:update');
  });

  return io;
}

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'telegram-bot-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8 // 8 hours
  }
}));

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Static files
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple auth middleware (có thể nâng cấp sau)
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  // lưu lại url để login xong quay về
  try {
    req.session.redirectTo = req.originalUrl || '/';
  } catch {}
  return res.redirect('/login');
}

// Routes
app.get('/login', async (req, res) => {
  res.render('login', {
    title: 'Đăng nhập',
    error: null
  });
});

app.post('/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();

    const adminUser = String(process.env.ADMIN_USER || 'admin');
    const adminPass = String(process.env.ADMIN_PASS || 'admin');

    if (!username || !password) {
      return res.status(400).render('login', { title: 'Đăng nhập', error: 'Vui lòng nhập đầy đủ tài khoản và mật khẩu.' });
    }

    if (username !== adminUser || password !== adminPass) {
      return res.status(401).render('login', { title: 'Đăng nhập', error: 'Sai tài khoản hoặc mật khẩu.' });
    }

    req.session.userId = username;
    const redirectTo = req.session.redirectTo || '/';
    delete req.session.redirectTo;
    return res.redirect(redirectTo);
  } catch (error) {
    return res.status(500).render('login', { title: 'Đăng nhập', error: error.message || 'Lỗi không xác định' });
  }
});

app.post('/logout', requireAuth, async (req, res) => {
  try {
    req.session.destroy(() => res.redirect('/login'));
  } catch {
    res.redirect('/login');
  }
});

app.get('/', requireAuth, async (req, res) => {
  try {
    let botInfo = null;
    if (bot) {
      botInfo = await bot.telegram.getMe();
    }
    res.render('dashboard', {
      title: 'Dashboard',
      botInfo,
      user: { id: req.session.userId }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('dashboard', {
      title: 'Dashboard',
      botInfo: null,
      error: error.message
    });
  }
});

app.get('/manage-bot', requireAuth, async (req, res) => {
  try {
    let botInfo = null;
    if (bot) {
      botInfo = await bot.telegram.getMe();
    }
    res.render('manage-bot', {
      title: 'Quản lý Bot',
      botInfo,
      user: { id: req.session.userId }
    });
  } catch (error) {
    res.render('manage-bot', {
      title: 'Quản lý Bot',
      botInfo: null,
      error: error.message,
      user: { id: req.session.userId }
    });
  }
});

app.get('/groups', requireAuth, async (req, res) => {
  res.render('groups', {
    title: 'Quản lý Nhóm',
    user: { id: req.session.userId }
  });
});

app.get('/commands', requireAuth, async (req, res) => {
  // Đọc danh sách commands từ thư mục
  const commandsDir = path.join(__dirname, '..', 'src', 'commands');
  const commands = [];
  
  try {
    const files = fs.readdirSync(commandsDir);
    for (const file of files) {
      if (file.endsWith('.js') && !file.includes('_')) {
        try {
          const cmd = require(path.join(commandsDir, file));
          if (cmd.name && cmd.handler) {
            commands.push({
              name: cmd.name,
              aliases: cmd.aliases || [],
              description: cmd.description || 'Không có mô tả'
            });
          }
        } catch (e) {
          // Skip invalid files
        }
      }
    }
    
    // Đọc commands từ subfolders
    const subfolders = fs.readdirSync(commandsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory());
    
    for (const folder of subfolders) {
      const indexPath = path.join(commandsDir, folder.name, 'index.js');
      if (fs.existsSync(indexPath)) {
        try {
          const cmd = require(indexPath);
          if (cmd.name && cmd.handler) {
            commands.push({
              name: cmd.name,
              aliases: cmd.aliases || [],
              description: cmd.description || 'Không có mô tả'
            });
          }
        } catch (e) {
          // Skip
        }
      }
    }
  } catch (error) {
    console.error('Error loading commands:', error);
  }
  
  res.render('commands', {
    title: 'Quản lý Commands',
    commands,
    user: { id: req.session.userId }
  });
});

app.get('/logs', requireAuth, async (req, res) => {
  res.render('logs', {
    title: 'Xem Logs',
    user: { id: req.session.userId }
  });
});

app.get('/settings', requireAuth, async (req, res) => {
  res.render('settings', {
    title: 'Cài đặt',
    nodeVersion: process.version,
    platform: process.platform,
    user: { id: req.session.userId }
  });
});

app.get('/create-bot', requireAuth, async (req, res) => {
  res.render('create-bot', {
    title: 'Tạo Bot',
    user: { id: req.session.userId }
  });
});

// API Routes
app.get('/api/bot/info', requireAuth, async (req, res) => {
  try {
    if (!bot) {
      return res.json({ success: false, error: 'Bot chưa được khởi động' });
    }
    const botInfo = await bot.telegram.getMe();
    res.json({ success: true, data: botInfo });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/bot/stats', requireAuth, async (req, res) => {
  try {
    if (!readMessageLog) {
      return res.json({ success: false, error: 'Không thể đọc message log' });
    }
    const messageLog = readMessageLog();
    const totalMessages = Object.keys(messageLog).length;
    
    // Đếm theo chat
    const chatStats = {};
    for (const key in messageLog) {
      const entry = messageLog[key];
      if (entry && entry.chatId) {
        if (!chatStats[entry.chatId]) {
          chatStats[entry.chatId] = { count: 0, users: new Set() };
        }
        chatStats[entry.chatId].count++;
        if (entry.userId) {
          chatStats[entry.chatId].users.add(entry.userId);
        }
      }
    }
    
    // Convert Set to Array length
    for (const chatId in chatStats) {
      chatStats[chatId].users = chatStats[chatId].users.size;
    }
    
    res.json({
      success: true,
      data: {
        totalMessages,
        totalChats: Object.keys(chatStats).length,
        chatStats: Object.entries(chatStats).map(([chatId, stats]) => ({
          chatId,
          messageCount: stats.count,
          userCount: stats.users
        }))
      }
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/groups', requireAuth, async (req, res) => {
  try {
    // Đọc bot state để lấy danh sách groups
    const statePath = path.join(__dirname, '..', 'src', 'config', 'bot_state.json');
    let groups = [];
    
    if (fs.existsSync(statePath)) {
      const stateData = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      groups = Object.keys(stateData).map(chatId => ({
        chatId,
        enabled: stateData[chatId] || false
      }));
    }
    
    res.json({ success: true, data: groups });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/groups/:chatId/toggle', requireAuth, async (req, res) => {
  try {
    if (!botState) {
      return res.json({ success: false, error: 'Bot state không khả dụng' });
    }
    const { chatId } = req.params;
    const { enabled } = req.body;
    
    botState.setBotState(chatId, enabled === true || enabled === 'true');
    
    res.json({ success: true, message: `Bot ${enabled ? 'bật' : 'tắt'} thành công` });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/logs/messages', requireAuth, async (req, res) => {
  try {
    if (!readMessageLog) {
      return res.json({ success: false, error: 'Không thể đọc message log' });
    }
    const { limit = 100, offset = 0 } = req.query;
    const messageLog = readMessageLog();
    
    const entries = Object.entries(messageLog)
      .sort((a, b) => (b[1].timestamp || b[1].savedAt || 0) - (a[1].timestamp || a[1].savedAt || 0))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
      .map(([key, value]) => ({
        key,
        ...value,
        timestamp: value.timestamp || value.savedAt
      }));
    
    res.json({ success: true, data: entries, total: Object.keys(messageLog).length });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/logs/feedback', requireAuth, async (req, res) => {
  try {
    const feedbackPath = path.join(__dirname, '..', 'logs', 'feedback.log');
    if (fs.existsSync(feedbackPath)) {
      const content = fs.readFileSync(feedbackPath, 'utf8');
      res.json({ success: true, data: content });
    } else {
      res.json({ success: true, data: '' });
    }
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.get('/api/logs/reports', requireAuth, async (req, res) => {
  try {
    const reportsPath = path.join(__dirname, '..', 'logs', 'reports.log');
    if (fs.existsSync(reportsPath)) {
      const content = fs.readFileSync(reportsPath, 'utf8');
      res.json({ success: true, data: content });
    } else {
      res.json({ success: true, data: '' });
    }
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ── Bot Management API ──
app.get('/api/bots', requireAuth, async (req, res) => {
  try {
    if (!botManager) {
      return res.json({ success: false, error: 'Bot manager không khả dụng' });
    }
    const bots = botManager.getAllBots();
    res.json({ success: true, data: bots });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/bots/create', requireAuth, async (req, res) => {
  try {
    if (!botManager) {
      return res.json({ success: false, error: 'Bot manager không khả dụng' });
    }
    const { token, name } = req.body;
    
    if (!token) {
      return res.json({ success: false, error: 'BOT_TOKEN là bắt buộc' });
    }
    
    const botData = await botManager.addBot(token, name);
    emitBotsUpdate();
    res.json({ success: true, data: botData, message: 'Bot đã được tạo thành công' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/bots/:botId/start', requireAuth, async (req, res) => {
  try {
    if (!botManager) {
      return res.json({ success: false, error: 'Bot manager không khả dụng' });
    }
    const { botId } = req.params;
    const result = await botManager.startBot(botId);
    emitBotsUpdate();
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/api/bots/:botId/stop', requireAuth, async (req, res) => {
  try {
    if (!botManager) {
      return res.json({ success: false, error: 'Bot manager không khả dụng' });
    }
    const { botId } = req.params;
    const result = await botManager.stopBot(botId);
    emitBotsUpdate();
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.delete('/api/bots/:botId/delete', requireAuth, async (req, res) => {
  try {
    if (!botManager) {
      return res.json({ success: false, error: 'Bot manager không khả dụng' });
    }
    const { botId } = req.params;
    const result = await botManager.deleteBot(botId);
    emitBotsUpdate();
    res.json(result);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Start server (when running standalone)
if (require.main === module) {
  const server = http.createServer(app);
  attachRealtime(server);
  server.listen(PORT, () => {
    console.log(`🌐 Website quản lý bot đang chạy tại: http://localhost:${PORT}`);
  });
}

module.exports = { app, attachRealtime };

