const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const LRU = require('lru-cache');
const { fileURLToPath } = require('url');
// no getGlobalPrefix required here
// Do not depend on chat-zalo helpers in this repo; keep search-only behavior
// avoid dependency on utils/format-util in this workspace; use message.text directly
// sendVoiceMusic / caching not available in this workspace; omit playback in this command
const getCachedMedia = null;
const setCacheData = null;
// stub minimal util functions used by this command
async function deleteFile(p) { try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {} }
async function deleteRepliedMessage(api, message) { /* no-op in Telegram conversion */ }
// no image creation dependency

let clientId;

const PLATFORM = 'soundcloud';
// __dirname is available in CommonJS modules
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];
const TIME_TO_SELECT = 60000;

const acceptLanguages = ['en-US,en;q=0.9', 'fr-FR,fr;q=0.9', 'es-ES,es;q=0.9', 'de-DE,de;q=0.9', 'zh-CN,zh;q=0.9'];

const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];

const getHeaders = () => ({
  'User-Agent': getRandomElement(userAgents),
  'Accept-Language': getRandomElement(acceptLanguages),
  Referer: 'https://soundcloud.com/',
  'Upgrade-Insecure-Requests': '1',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
});

async function readConfig() {
  try {
    const cfgPath = path.join(__dirname, '..', '..', 'config.json');
    if (fs.existsSync(cfgPath)) return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch (e) {}
  return {};
}

async function getClientId() {
  try {
    const cfg = await readConfig();
    const now = new Date();
    if (cfg.soundcloud && cfg.soundcloud.clientId && cfg.soundcloud.lastUpdate) {
      const last = new Date(cfg.soundcloud.lastUpdate);
      const days = (now - last) / (1000 * 60 * 60 * 24);
      if (days < 3) return cfg.soundcloud.clientId;
    }

    const res = await axios.get('https://soundcloud.com/', { headers: getHeaders() });
    const dom = new JSDOM(res.data);
    const scripts = Array.from(dom.window.document.querySelectorAll('script[crossorigin]')).map(s => s.src).filter(Boolean);
    if (!scripts.length) throw new Error('no script urls');
    const scriptRes = await axios.get(scripts[scripts.length - 1], { headers: getHeaders() });
    const data = scriptRes.data;
    const cid = data.split(',client_id:"')[1]?.split('"')[0];
    if (!cid) throw new Error('no client id');

  // write back
  const cfgPath = path.join(__dirname, '..', '..', 'config.json');
  let existingCfg = {};
  try { existingCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch(e) { existingCfg = {}; }
  existingCfg.soundcloud = { clientId: cid, lastUpdate: now.toISOString() };
  fs.writeFileSync(cfgPath, JSON.stringify(existingCfg, null, 2));
    return cid;
  } catch (e) {
    try { const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); return cfg.soundcloud.clientId; } catch { return null; }
  }
}

async function getMusicInfo(question, limit) {
  limit = limit || 10;
  try {
    const res = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
      params: { q: question, variant_ids: '', facet: 'genre', client_id: clientId, limit, offset: 0, linked_partitioning: 1, app_locale: 'en' },
      headers: getHeaders()
    });
    return res.data;
  } catch (e) {
    return null;
  }
}

async function getMusicStreamUrl(link) {
  try {
    const headers = getHeaders();
    const apiUrl = `https://api-v2.soundcloud.com/resolve?url=${link}&client_id=${clientId}`;
    const res = await axios.get(apiUrl, { headers });
    const data = res.data;
    const progressive = data?.media?.transcodings?.find(t => t.format && t.format.protocol === 'progressive');
    if (!progressive) return null;
    const progressiveUrl = progressive.url;
    const streamRes = await axios.get(`${progressiveUrl}?client_id=${clientId}${data.track_authorization ? `&track_authorization=${data.track_authorization}` : ''}`, { headers });
    const streamUrl = streamRes.data?.url;
    return { streamUrl, track: data };
  } catch (e) {
    return null;
  }
}

const musicSelectionsMap = new LRU({ max: 500, ttl: TIME_TO_SELECT });

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function downloadToFile(url, destPath) {
  const writer = fs.createWriteStream(destPath);
  const res = await axios.get(url, { responseType: 'stream', headers: getHeaders(), timeout: 60000 });
  return new Promise((resolve, reject) => {
    res.data.pipe(writer);
    let error = null;
    writer.on('error', err => { error = err; writer.close(); reject(err); });
    writer.on('close', () => { if (!error) resolve(destPath); });
  });
}

async function convertToOgg(inputPath, outputPath) {
  // Use ffmpeg to convert input to ogg/opus which Telegram accepts well
  // -y overwrite, -vn no video
  const cmd = `ffmpeg -y -i "${inputPath}" -vn -c:a libopus -b:a 96k "${outputPath}"`;
  await execAsync(cmd);
  return outputPath;
}

async function convertToMp3(inputPath, outputPath) {
  // Fallback: convert to MP3 using libmp3lame
  const cmd = `ffmpeg -y -i "${inputPath}" -vn -c:a libmp3lame -b:a 128k "${outputPath}"`;
  await execAsync(cmd);
  return outputPath;
}

async function sendSelectionAudio(ctx, selectionIndex, selectionKey) {
  const entry = musicSelectionsMap.get(selectionKey);
  if (!entry || !entry.collection) return ctx.reply('Không tìm thấy lựa chọn, hãy tìm kiếm lại bằng /scl <từ khóa>');
  const track = entry.collection[selectionIndex];
  if (!track) return ctx.reply('Số lựa chọn không hợp lệ.');

  // Store messages to delete after sending audio
  const messagesToDelete = [];
  const chatId = ctx.chat && ctx.chat.id;
  
  // Add the selection list message if it exists
  if (entry.listMessageId) messagesToDelete.push(entry.listMessageId);
  // Add the user's reply message (the number they typed)
  if (ctx.message && ctx.message.message_id) messagesToDelete.push(ctx.message.message_id);

  try {
    const loadingMsg = await ctx.reply(`⏬ Đang tải bài: ${track.title} — ${track.user?.username || ''}`);
    if (loadingMsg && loadingMsg.message_id) messagesToDelete.push(loadingMsg.message_id);

    const link = track.permalink_url || track.uri || `https://soundcloud.com/${track.user?.permalink}/${track.slug || ''}`;
    const resolved = await getMusicStreamUrl(link);
    if (!resolved || !resolved.streamUrl) return ctx.reply('Không thể lấy đường dẫn stream cho bài hát này.');

    const tmpDir = path.join(__dirname, '..', '..', 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `scl_${Date.now()}_${Math.random().toString(36).slice(2,8)}.mp3`);
    await downloadToFile(resolved.streamUrl, tmpFile);

    // Try convert to OGG first, if it fails, fallback to MP3
    const outOgg = tmpFile.replace(/\.mp3$/i, '.ogg');
    try {
      await convertToOgg(tmpFile, outOgg);
      await ctx.replyWithAudio({ source: fs.createReadStream(outOgg) }, { title: track.title, performer: track.user?.username });
      
      // Delete previous messages after successful send
      if (chatId && ctx.telegram) {
        for (const msgId of messagesToDelete) {
          try { await ctx.telegram.deleteMessage(chatId, msgId); } catch (e) {}
        }
      }
      
      // cleanup
      try { fs.unlinkSync(tmpFile); } catch (e) {}
      try { fs.unlinkSync(outOgg); } catch (e) {}
      return;
    } catch (convErr) {
      console.warn('convertToOgg failed, trying MP3 fallback', convErr && convErr.message);
      const outMp3 = tmpFile.replace(/\.mp3$/i, '.out.mp3');
      try {
        await convertToMp3(tmpFile, outMp3);
        await ctx.replyWithAudio({ source: fs.createReadStream(outMp3) }, { title: track.title, performer: track.user?.username });
        
        // Delete previous messages after successful send
        if (chatId && ctx.telegram) {
          for (const msgId of messagesToDelete) {
            try { await ctx.telegram.deleteMessage(chatId, msgId); } catch (e) {}
          }
        }
        
        try { fs.unlinkSync(tmpFile); } catch (e) {}
        try { fs.unlinkSync(outMp3); } catch (e) {}
        return;
      } catch (mp3Err) {
        console.error('MP3 fallback failed', mp3Err && mp3Err.message);
        try { fs.unlinkSync(tmpFile); } catch (e) {}
        return ctx.reply('Đã xảy ra lỗi khi chuyển đổi audio.');
      }
    }
  } catch (e) {
    console.error('sendSelectionAudio error', e && e.message);
    return ctx.reply('Đã xảy ra lỗi khi xử lý audio.');
  }
}

async function sclCommand(ctx) {
  const text = (ctx.message && ctx.message.text) || '';
  const parts = text.trim().split(/\s+/);
  const keyword = parts.slice(1).join(' ');
  if (!keyword) return ctx.reply('Sử dụng: /scl <từ khóa> — ví dụ: /scl Bài Hát Yêu Thích');

  // Store messages to delete after user selects
  const messagesToDelete = [];
  const chatId = ctx.chat && ctx.chat.id;

  try {
    if (!clientId) clientId = await getClientId();
    const searchMsg = await ctx.reply(`🔎 Đang tìm bài hát trên SoundCloud: ${keyword}`);
    if (searchMsg && searchMsg.message_id) messagesToDelete.push(searchMsg.message_id);
    
  // If keyword is a URL, try to resolve and play immediately
  const maybeUrl = parts[1] || '';
  const immediateNumber = parts[parts.length - 1] && parts[parts.length - 1].match(/^\d+$/) ? parseInt(parts[parts.length - 1], 10) : null;
  const isUrl = /^https?:\/\//i.test(maybeUrl);
  const info = await getMusicInfo(keyword, 10);
  // If the user provided a trailing number (e.g., /scl <keyword> 2) and we have results, play immediately
  if (immediateNumber && info && info.collection && info.collection.length >= immediateNumber) {
    const msgIdKey = ctx.message && ctx.message.message_id ? String(ctx.message.message_id) : String(Date.now());
    // store selection collection for this message so sendSelectionAudio can use it
    musicSelectionsMap.set(msgIdKey, { userRequest: ctx.from && ctx.from.id, collection: info.collection, timestamp: Date.now() });
    // selection index is 0-based
    await sendSelectionAudio(ctx, immediateNumber - 1, msgIdKey);
    
    // Delete search message after sending audio
    if (chatId && ctx.telegram) {
      for (const msgId of messagesToDelete) {
        try { await ctx.telegram.deleteMessage(chatId, msgId); } catch (e) {}
      }
    }
    return;
  }
  // If argument is a direct URL, try resolve and play
  if (isUrl) {
    // create a fake entry collection with resolved track
    const tmpMsgKey = String(Date.now());
    // Try to resolve via API
    try {
      const resolved = await getMusicStreamUrl(maybeUrl);
      if (!resolved || !resolved.streamUrl) return ctx.reply('Không thể lấy đường dẫn stream từ URL đã cung cấp.');
      // create a minimal track object for sending
      const fakeTrack = { title: maybeUrl, user: { username: '' }, permalink_url: maybeUrl };
      musicSelectionsMap.set(tmpMsgKey, { userRequest: ctx.from && ctx.from.id, collection: [fakeTrack], timestamp: Date.now() });
      await downloadToFile(resolved.streamUrl, path.join(__dirname, '..', '..', 'tmp', `scl_direct_${Date.now()}.mp3`));
      // reuse sendSelectionAudio to send the first (and only) track
      await sendSelectionAudio(ctx, 0, tmpMsgKey);
      
      // Delete search message after sending audio
      if (chatId && ctx.telegram) {
        for (const msgId of messagesToDelete) {
          try { await ctx.telegram.deleteMessage(chatId, msgId); } catch (e) {}
        }
      }
    } catch (e) {
      console.error('direct url play error', e && e.message);
      return ctx.reply('Lỗi khi xử lý URL SoundCloud.');
    }
    return;
  }
  if (!info || !info.collection || info.collection.length === 0) return ctx.reply(`Không tìm thấy kết quả cho: ${keyword}`);
  // Tiêu đề/gợi ý bằng tiếng Việt
  const musicListTxt = "Đây là danh sách bài hát trên SoundCloud mà tôi tìm thấy:\nHãy trả lời tin nhắn này với số thứ tự của bài hát bạn muốn nghe (ví dụ: 1).";
  const items = info.collection.slice(0, 10);
  const listText = items.map((t, i) => `${i + 1}. ${t.title} — ${t.user?.username || 'Unknown'}`).join('\n');
  const replyText = `${musicListTxt}\n\n${listText}`;
  // send the reply and capture the bot message id so replies to that message work
  const sent = await ctx.reply(replyText);
  
  // Delete search message but keep the selection list
  if (chatId && ctx.telegram) {
    for (const msgId of messagesToDelete) {
      try { await ctx.telegram.deleteMessage(chatId, msgId); } catch (e) {}
    }
  }
  
  // store collection keyed by the bot reply message id and by chat id so user can send number without replying
  const msgIdKey = sent && sent.message_id ? String(sent.message_id) : (ctx.message && ctx.message.message_id ? String(ctx.message.message_id) : String(Date.now()));
  const chatKey = ctx.chat && ctx.chat.id ? `chat_${ctx.chat.id}` : null;
  const stored = { userRequest: ctx.from && ctx.from.id, collection: info.collection, timestamp: Date.now(), listMessageId: sent && sent.message_id };
  musicSelectionsMap.set(msgIdKey, stored);
  if (chatKey) musicSelectionsMap.set(chatKey, stored);
  } catch (e) {
    console.error('scl command error', e && e.message);
    return ctx.reply('Đã có lỗi khi tìm kiếm SoundCloud.');
  }
}

module.exports = sclCommand;

  // export helper for reply handler
  module.exports.sendSelectionAudio = sendSelectionAudio;
  module.exports.musicSelectionsMap = musicSelectionsMap;

