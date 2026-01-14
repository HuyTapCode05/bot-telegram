const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Minimal, self-contained ZingMP3 search command (CommonJS)
let API_KEY = 'NO_API_KEY';
let SECRET_KEY = 'NO_SECRET';
let VERSION = '1.0.0';

try {
  const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');
  if (fs.existsSync(CONFIG_PATH)) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (cfg && cfg.zingmp3) {
      API_KEY = cfg.zingmp3.apiKey || API_KEY;
      SECRET_KEY = cfg.zingmp3.secretKey || SECRET_KEY;
      VERSION = cfg.zingmp3.version || VERSION;
    }
  }
} catch (e) {
  // ignore
}

const ZING_URL = 'https://zingmp3.vn';
let cheerio;
try { cheerio = require('cheerio'); } catch (e) { cheerio = null; }
const LRU = require('lru-cache');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const TIME_TO_SELECT = 60000; // ms
const musicSelectionsMapZing = new LRU({ max: 500, ttl: TIME_TO_SELECT });
const P_WHITELIST = ['ctime', 'id', 'type', 'page', 'count', 'version'];

function getHash256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function downloadToFile(url, destPath) {
  const writer = fs.createWriteStream(destPath);
  const res = await axios.get(url, { responseType: 'stream', headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 60000 });
  return new Promise((resolve, reject) => {
    res.data.pipe(writer);
    let error = null;
    writer.on('error', err => { error = err; writer.close(); reject(err); });
    writer.on('close', () => { if (!error) resolve(destPath); });
  });
}

async function convertToOgg(inputPath, outputPath) {
  const cmd = `ffmpeg -y -i "${inputPath}" -vn -c:a libopus -b:a 96k "${outputPath}"`;
  await execAsync(cmd);
  return outputPath;
}

async function convertToMp3(inputPath, outputPath) {
  const cmd = `ffmpeg -y -i "${inputPath}" -vn -c:a libmp3lame -b:a 128k "${outputPath}"`;
  await execAsync(cmd);
  return outputPath;
}

async function getZingStreamUrl(link) {
  try {
    // ensure full URL
    const url = link.startsWith('http') ? link : `${ZING_URL}${link}`;
    // try static fetch first and look for og:audio meta
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
    const html = String(res.data || '');
    // meta property og:audio
    const m = html.match(/<meta[^>]+property=["']og:audio["'][^>]+content=["']([^"']+)["'][^>]*>/i);
    if (m && m[1]) return m[1];
    // try JSON blob with "streaming"/"source" markers
    const jsonMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{.+?\})\s*;\s*window/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        // navigate parsed to find audio url (best-effort)
        const track = parsed?.songs?.items?.[0] || parsed?.song || null;
        const audio = track?.streamUrl || track?.audio || track?.source || null;
        if (audio) return audio;
      } catch (e) {}
    }
    // Puppeteer fallback: render and read meta or audio src
    let puppeteer;
    try { puppeteer = require('puppeteer'); } catch (e) { return null; }
    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'], headless: true });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // small wait
    if (typeof page.waitForTimeout === 'function') await page.waitForTimeout(1000); else await new Promise(r => setTimeout(r, 1000));
    const found = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="og:audio"]') || document.querySelector('meta[name="og:audio"]');
      if (meta && meta.content) return meta.content;
      const audio = document.querySelector('audio');
      if (audio && audio.src) return audio.src;
      // try elements with data-src
      const a = document.querySelector('[data-src]');
      if (a) return a.getAttribute('data-src');
      return null;
    });
    await browser.close();
    return found || null;
  } catch (e) {
    return null;
  }
}

async function sendSelectionAudioZing(ctx, selectionIndex, selectionKey) {
  const entry = musicSelectionsMapZing.get(selectionKey);
  if (!entry || !entry.collection) return ctx.reply('Không tìm thấy lựa chọn, hãy tìm kiếm lại bằng /zingmp3 <từ khóa>');
  const track = entry.collection[selectionIndex];
  if (!track) return ctx.reply('Số lựa chọn không hợp lệ.');
  try {
    await ctx.reply(`⏬ Đang tải bài: ${track.title} — ${track.artistsNames || ''}`);
    const link = track.href || track.link || track.url;
    if (!link) return ctx.reply('Không tìm thấy đường dẫn bài hát.');
    const streamUrl = await getZingStreamUrl(link);
    if (!streamUrl) return ctx.reply('Không thể lấy đường dẫn stream cho bài hát này.');
    const tmpDir = path.join(__dirname, '..', '..', 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `zing_${Date.now()}_${Math.random().toString(36).slice(2,8)}.mp3`);
    await downloadToFile(streamUrl, tmpFile);
    const outOgg = tmpFile.replace(/\.mp3$/i, '.ogg');
    try {
      await convertToOgg(tmpFile, outOgg);
      await ctx.replyWithAudio({ source: fs.createReadStream(outOgg) }, { title: track.title, performer: track.artistsNames });
      try { fs.unlinkSync(tmpFile); } catch (e) {}
      try { fs.unlinkSync(outOgg); } catch (e) {}
      return;
    } catch (convErr) {
      const outMp3 = tmpFile.replace(/\.mp3$/i, '.out.mp3');
      try {
        await convertToMp3(tmpFile, outMp3);
        await ctx.replyWithAudio({ source: fs.createReadStream(outMp3) }, { title: track.title, performer: track.artistsNames });
        try { fs.unlinkSync(tmpFile); } catch (e) {}
        try { fs.unlinkSync(outMp3); } catch (e) {}
        return;
      } catch (mp3Err) {
        try { fs.unlinkSync(tmpFile); } catch (e) {}
        return ctx.reply('Đã xảy ra lỗi khi chuyển đổi audio.');
      }
    }
  } catch (e) {
    console.error('sendSelectionAudioZing error', e && e.message);
    return ctx.reply('Đã xảy ra lỗi khi xử lý audio.');
  }
}

function getHmac512(str, key) {
  return crypto.createHmac('sha512', key).update(Buffer.from(str, 'utf8')).digest('hex');
}

function sortParams(params) {
  const sorted = {};
  Object.keys(params).sort().forEach(k => { sorted[k] = params[k]; });
  return sorted;
}

function encodeParamsToString(params, separator = '') {
  const encode = encodeURIComponent;
  return Object.keys(params).map(key => {
    const value = encode(params[key]);
    return value.length > 5000 ? '' : `${encode(key)}=${value}`;
  }).filter(Boolean).join(separator);
}

function getStringParams(params) {
  const sorted = sortParams(params);
  const filtered = {};
  for (const k in sorted) {
    if (P_WHITELIST.includes(k) && sorted[k] !== null && sorted[k] !== undefined && String(sorted[k]) !== '') {
      filtered[k] = sorted[k];
    }
  }
  return encodeParamsToString(filtered, '');
}

function getSig(pathUrl, params) {
  const stringParams = getStringParams(params);
  return getHmac512(pathUrl + getHash256(stringParams), SECRET_KEY);
}

async function getCookie() {
  try {
    const res = await axios.get(ZING_URL, { timeout: 10000 });
    if (res.headers && res.headers['set-cookie']) return res.headers['set-cookie'][1] || res.headers['set-cookie'][0];
    return null;
  } catch (e) {
    return null;
  }
}

async function requestZing(pathUrl, params = {}) {
  const cookie = await getCookie();
  const res = await axios.get(`${ZING_URL}${pathUrl}`, { params, headers: cookie ? { Cookie: cookie } : {}, timeout: 15000 });
  return res.data;
}

async function searchMusicZing(keyword, count = 8) {
  const ctime = String(Math.floor(Date.now() / 1000));
  const pathApi = '/api/v2/search';
  const params = {
    q: keyword,
    type: 'song',
    count: count,
    allowCorrect: 1,
    ctime,
    version: VERSION,
    apiKey: API_KEY
  };
  const sig = getSig(pathApi, params);
  return requestZing(pathApi, { ...params, sig });
}

// Fallback: scrape ZingMP3 search results page using cheerio
async function searchMusicZingScrape(keyword, count = 8) {
  try {
    // Attempt the site search page that lists results
    const url = `https://zingmp3.vn/tim-kiem/tat-ca?q=${encodeURIComponent(keyword)}`;
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
    const html = String(res.data || '');
    const $ = cheerio.load(html);
    const results = [];
    // find links to songs; typical path contains '/bai-hat/'
    $('a[href*="/bai-hat/"]').each((i, el) => {
      if (results.length >= count) return;
      const href = $(el).attr('href') || '';
      const title = ($(el).find('.song-title').text() || $(el).attr('title') || $(el).text()).trim();
      // try to find artist name nearby
      let artist = $(el).find('.artist-name').text().trim();
      if (!artist) {
        const parent = $(el).closest('.song-item, .item');
        artist = parent.find('.artist-name').text().trim() || parent.find('.other').text().trim();
      }
      results.push({ title: title || href.split('/').pop(), artistsNames: artist || '' , href });
    });

    // If no anchors, try more generic selectors
    if (results.length === 0) {
      $('div.item, li.item').each((i, el) => {
        if (results.length >= count) return;
        const a = $(el).find('a[href*="/bai-hat/"]');
        if (!a || a.length === 0) return;
        const title = a.find('.song-title').text().trim() || a.attr('title') || a.text().trim();
        const artist = $(el).find('.author').text().trim() || $(el).find('.artist').text().trim();
        results.push({ title: title || '', artistsNames: artist || '', href: a.attr('href') });
      });
    }

    return { ok: true, data: { items: results.slice(0, count) } };
  } catch (err) {
    return { ok: false, error: err && (err.message || String(err)) };
  }
}

// Scrape fallback when API is unavailable or returns no results
async function scrapeZingSearch(keyword, max = 8) {
  if (!cheerio) return { ok: false, error: 'cheerio not installed' };
  const tryUrls = [
    `${ZING_URL}/tim-kiem/tat-ca.html?q=${encodeURIComponent(keyword)}`,
    `${ZING_URL}/tim-kiem.html?q=${encodeURIComponent(keyword)}`,
    `${ZING_URL}/tim-kiem?q=${encodeURIComponent(keyword)}`,
    `${ZING_URL}/tim-kiem/tat-ca?q=${encodeURIComponent(keyword)}`
  ];

  for (const url of tryUrls) {
    try {
      const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
      const html = String(res.data || '');
      const $ = cheerio.load(html);
      // collect links to /bai-hat/ which usually point to songs
      const results = [];
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href') || '';
        if (/\/bai-hat\//.test(href)) {
          const title = $(el).text().trim();
          if (title && !results.find(r => r.title === title)) {
            results.push({ title, href });
            if (results.length >= max) return false;
          }
        }
      });
      if (results.length > 0) return { ok: true, data: results };
    } catch (e) {
      // try next
    }
  }
  return { ok: false, data: [] };
}

// Puppeteer fallback: fully render the search page and extract song links/titles
async function searchMusicZingPuppeteer(keyword, max = 8) {
  // lazy-require puppeteer to avoid startup cost when not used
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) { return { ok: false, error: 'puppeteer not installed' }; }

  const url = `${ZING_URL}/tim-kiem/tat-ca?q=${encodeURIComponent(keyword)}`;
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

    // wait for potential result containers to appear
    try { await page.waitForSelector('a[href*="/bai-hat/"]', { timeout: 6000 }); } catch (e) { /* ignore */ }

    // extract links and titles
    const results = await page.evaluate((max) => {
      const out = [];
      const anchors = Array.from(document.querySelectorAll('a[href*="/bai-hat/"]'));
      for (const a of anchors) {
        if (out.length >= max) break;
        const href = a.getAttribute('href') || '';
        const title = (a.querySelector('.song-name, .song-title') || a).textContent || '';
        const artistEl = a.closest('.song-item, .item')?.querySelector('.artist-name, .author') || null;
        const artist = artistEl ? artistEl.textContent.trim() : '';
        out.push({ title: title.trim(), artistsNames: artist, href });
      }
      return out.slice(0, max);
    }, max);

    await browser.close();
    return { ok: true, data: { items: results } };
  } catch (err) {
    if (browser) try { await browser.close(); } catch (e) {}
    return { ok: false, error: err && err.message };
  }
}

// Puppeteer fallback: load page and scrape rendered DOM
async function searchMusicZingPuppeteer(keyword, max = 8) {
  try {
    const puppeteer = require('puppeteer');
    const url = `https://zingmp3.vn/tim-kiem/tat-ca?q=${encodeURIComponent(keyword)}`;
    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for elements that likely contain results (support older Puppeteer versions)
    if (typeof page.waitForTimeout === 'function') {
      await page.waitForTimeout(1200);
    } else if (typeof page.waitFor === 'function') {
      // older puppeteer: waitFor(milliseconds)
      await page.waitFor(1200);
    } else {
      // fallback
      await new Promise((res) => setTimeout(res, 1200));
    }

    const results = await page.evaluate((max) => {
      const out = [];
      // song anchors often contain '/bai-hat/' in href
      const anchors = Array.from(document.querySelectorAll('a[href*="/bai-hat/"]'));
      for (const a of anchors) {
        if (out.length >= max) break;
        const href = a.getAttribute('href') || '';
        let title = a.querySelector('.song-title')?.textContent || a.getAttribute('title') || a.textContent || '';
        title = title.trim();
        // artist may be in sibling or parent
        let artist = '';
        const parent = a.closest('.song-item, .item, .media, .song');
        artist = parent?.querySelector('.artist-name')?.textContent || parent?.querySelector('.author')?.textContent || '';
        artist = (artist || '').trim();
        if (!title) title = href.split('/').pop();
        out.push({ title, artistsNames: artist, href });
      }
      return out.slice(0, max);
    }, max);

    await browser.close();
    return { ok: true, data: results };
  } catch (e) {
    return { ok: false, error: e && (e.message || String(e)) };
  }
}

// Telegraf command handler
async function zingmp3Command(ctx) {
  const text = (ctx.message && ctx.message.text) || '';
  const parts = text.trim().split(/\s+/);
  const keyword = parts.slice(1).join(' ');
  if (!keyword) return ctx.reply('Sử dụng: /zingmp3 <từ khóa> — ví dụ: /zingmp3 Bài Hát Yêu Thích');

  // helper: remove Vietnamese diacritics (e.g. "nói dối" -> "noi doi")
  function removeDiacritics(str) {
    if (!str) return str;
    try {
      return str.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    } catch (e) {
      // fallback for environments without full unicode property support
      return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    }
  }

  try {
    await ctx.reply(`🔎 Đang tìm bài hát: ${keyword} ...`);
    let res = null;

    async function trySearch(q) {
      function isEmptyResult(r) {
        if (!r) return true;
        if (r.ok === false) return true;
        if (r.data && Array.isArray(r.data.items) && r.data.items.length === 0) return true;
        if (Array.isArray(r.data) && r.data.length === 0) return true;
        return false;
      }

      // If no API key, try scraper then puppeteer fallback
      if (!API_KEY || API_KEY === 'NO_API_KEY') {
        let s = await searchMusicZingScrape(q, 8);
        if (isEmptyResult(s) && typeof searchMusicZingPuppeteer === 'function') {
          try {
            s = await searchMusicZingPuppeteer(q, 8);
          } catch (e) {
            // ignore
          }
        }
        return s;
      } else {
        try {
          let r = await searchMusicZing(q, 8);
          if (isEmptyResult(r)) {
            r = await searchMusicZingScrape(q, 8);
          }
          if (isEmptyResult(r) && typeof searchMusicZingPuppeteer === 'function') {
            try {
              r = await searchMusicZingPuppeteer(q, 8);
            } catch (e) {
              // ignore
            }
          }
          return r;
        } catch (e) {
          let r = await searchMusicZingScrape(q, 8);
          if (isEmptyResult(r) && typeof searchMusicZingPuppeteer === 'function') {
            try {
              r = await searchMusicZingPuppeteer(q, 8);
            } catch (ee) {
              // ignore
            }
          }
          return r;
        }
      }
    }

    // First attempt with original keyword
    res = await trySearch(keyword);

    // If no results, try with diacritics removed
    if ((!res || (!res.data && !res.ok)) || (res.data && Array.isArray(res.data.items) && res.data.items.length === 0) || (Array.isArray(res.data) && res.data.length === 0)) {
      const alt = removeDiacritics(keyword);
      if (alt && alt !== keyword) {
        try {
          await ctx.reply(`🔁 Thử tìm lại với: ${alt} ...`);
        } catch (e) {}
        res = await trySearch(alt);
      }
    }

    if (!res || (!res.data && !res.ok)) {
      return ctx.reply(`Không tìm thấy kết quả cho: ${keyword}`);
    }

      // Heuristic: find the first array of objects in res that looks like search results
      let itemsRaw = [];
      function looksLikeItemsArray(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return false;
        const sample = arr.find(x => x && typeof x === 'object');
        if (!sample) return false;
        // check for common fields
        return ('title' in sample) || ('name' in sample) || ('href' in sample) || ('link' in sample) || ('permalink' in sample) || ('artists' in sample) || ('artistsNames' in sample);
      }
      if (res && res.data) {
        if (Array.isArray(res.data.items) && res.data.items.length) itemsRaw = res.data.items.slice(0, 8);
        else if (Array.isArray(res.data) && looksLikeItemsArray(res.data)) itemsRaw = res.data.slice(0, 8);
        else {
          // try to find any nested array
          const keys = Object.keys(res.data);
          for (const k of keys) {
            if (looksLikeItemsArray(res.data[k])) { itemsRaw = res.data[k].slice(0, 8); break; }
          }
        }
      }
      if (!itemsRaw.length && Array.isArray(res) && looksLikeItemsArray(res)) itemsRaw = res.slice(0,8);

      function cleanText(s) {
        if (!s && s !== 0) return '';
        let t = String(s);
        // remove HTML tags
        t = t.replace(/<[^>]*>/g, '');
        // decode a few common HTML entities
        t = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
        // collapse repeated dots or whitespace and remove placeholder-only strings
        t = t.replace(/\.{2,}/g, '.').replace(/\s{2,}/g, ' ').trim();
        if (/^[\.\-\s]{2,}$/.test(t)) return '';
        if (/^\.*$/.test(t)) return '';
        return t;
      }

      function getArtistName(raw) {
        if (!raw) return '';
        const tryFields = ['artistsNames','artists_names','artists','performer','artist','author','singer','creator'];
        for (const f of tryFields) {
          if (raw[f]) {
            if (Array.isArray(raw[f])) return cleanText(raw[f].map(a => a?.name || a?.alias || a?.title || a).filter(Boolean).join(', '));
            if (typeof raw[f] === 'string') return cleanText(raw[f]);
          }
        }
        // nested artists
        if (raw.artists && Array.isArray(raw.artists)) {
          const names = raw.artists.map(a => (a && (a.name || a.title || a.alias)) || '').filter(Boolean);
          if (names.length) return cleanText(names.join(', '));
        }
        return '';
      }

      function getTitle(raw) {
        if (!raw) return '';
        const candidates = [raw.title, raw.name, raw.vn_title, raw.title_with_artist, raw.alias, raw['title#text'], raw['name#text']];
        for (const c of candidates) if (c && String(c).trim()) return cleanText(c);
        // sometimes title is nested under 'data' or 'info'
        if (raw.data && raw.data.title) return cleanText(raw.data.title);
        if (raw.info && raw.info.title) return cleanText(raw.info.title);
        const href = raw.href || raw.link || raw.permalink || raw.url || '';
        if (href) return cleanText(href.split('/').pop());
        return '';
      }

      function getHref(raw) {
        if (!raw) return '';
        const h = raw.href || raw.link || raw.permalink || raw.url || raw.source || raw.path || '';
        return h ? String(h) : '';
      }

      let items = itemsRaw.map(r => {
        const title = getTitle(r) || '(No title)';
        const artist = getArtistName(r) || 'Unknown';
        const href = getHref(r) || '';
        return { title, artistsNames: artist, href };
      });

      // For items with placeholder titles or Unknown artist, try fetching the track page to get og meta
      async function enrichItem(item) {
        if ((!item.title || /^\(no title\)|^\.{1,3}$|^\.{2,}$/.test(item.title) || item.title.includes('...')) || (!item.artistsNames || item.artistsNames === 'Unknown')) {
          try {
            const url = item.href && item.href.startsWith('http') ? item.href : `${ZING_URL}${item.href}`;
            const r = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
            const html = String(r.data || '');
            // og:title and og:description
            const mt = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i);
            const md = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
            if (mt && mt[1]) item.title = cleanText(mt[1]);
            if (md && md[1]) {
              const desc = cleanText(md[1]);
              // description often includes artist or album info, try extract first line
              const firstLine = desc.split('\n')[0].split('—')[0].trim();
              if (firstLine) item.artistsNames = firstLine;
            }
            // fallback: parse DOM for selectors
            if (cheerio) {
              const $ = cheerio.load(html);
              const aTitle = $('h1.song-name, .song-title, .title').first().text().trim();
              const aArtist = $('.artist-name, .author, .singer').first().text().trim();
              if (aTitle) item.title = cleanText(aTitle);
              if (aArtist) item.artistsNames = cleanText(aArtist);
            }
          } catch (e) {
            // ignore
          }
        }
        return item;
      }

      // enrich sequentially (limit to avoid many requests)
      for (let i = 0; i < items.length; i++) {
        items[i] = await enrichItem(items[i]);
      }

    if (!items || items.length === 0) return ctx.reply(`Không tìm thấy kết quả cho: ${keyword}`);

    const lines = items.map((it, idx) => `${idx + 1}. ${it.title} — ${it.artistsNames || 'Unknown'}`);
    const reply = `Kết quả tìm kiếm cho: <b>${escapeHtml(keyword)}</b>\n\n${lines.join('\n')}\n\nTrả lời tin nhắn với số thứ tự để chọn bài.`;
  // create a unique key for this selection set (used in callback_data)
  const uid = `zing_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const chatKey = ctx.chat && ctx.chat.id ? `chat_${ctx.chat.id}` : null;
  const store = { userRequest: ctx.from && ctx.from.id, collection: items, timestamp: Date.now() };
  // store under uid and chatKey
  musicSelectionsMapZing.set(uid, store);
  if (chatKey) musicSelectionsMapZing.set(chatKey, store);

  // build inline keyboard with numbered buttons
  const keyboard = items.map((it, idx) => [{ text: `${idx + 1}. ${it.title.substring(0,24)}`, callback_data: `zing:${uid}:${idx}` }]);
  // add a cancel button
  keyboard.push([{ text: 'Huỷ', callback_data: `zing:${uid}:cancel` }]);

  await ctx.reply(reply, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
    // If user provided a trailing number in the original command (/zingmp3 keyword 2), play immediately using uid
    const parts = (ctx.message && ctx.message.text) ? ctx.message.text.trim().split(/\s+/) : [];
    const immediateNumber = parts[parts.length - 1] && parts[parts.length - 1].match(/^\d+$/) ? parseInt(parts[parts.length - 1], 10) : null;
    if (immediateNumber && store.collection && store.collection.length >= immediateNumber) {
      await sendSelectionAudioZing(ctx, immediateNumber - 1, uid);
    }
    return;
  } catch (err) {
    console.error('zingmp3 command error', err && (err.message || err));
    return ctx.reply('Đã có lỗi khi tìm kiếm ZingMP3.');
  }
};
function escapeHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// export helpers for debug scripts
module.exports = Object.assign(zingmp3Command, { searchMusicZingPuppeteer, searchMusicZingScrape, scrapeZingSearch, searchMusicZing, sendSelectionAudioZing, musicSelectionsMapZing });
