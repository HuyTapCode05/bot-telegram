const gtts = require('gtts');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { fileURLToPath } = require('url');
const { dirname } = require('path');
const util = require('util');
const { exec } = require('child_process');
// stubs for process-audio and utils used in original implementation
async function extractAudioFromVideo(url, ctx, message) { throw new Error('extractAudioFromVideo not implemented in this environment'); }
async function uploadAudioFile(filePath, api, message) { throw new Error('uploadAudioFile not implemented'); }
async function checkExstentionFileRemote(url) { return null; }
async function deleteFile(p) { try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {} }
async function downloadFile(url, dest) { throw new Error('downloadFile not implemented'); }
const execAsync = util.promisify(exec);
const tempDir = path.join(process.cwd(), 'tmp'); if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
// stubs for optional helpers (not present in this workspace)
async function createSpinningDiscGif() { return null; }
function normalizeSymbolName(s) { return s; }
function removeMention(message) { return (message && message.text) ? message.text : ''; }
async function createCircleWebp() { return null; }
async function createImageWebp() { return null; }
async function createMusicCard() { return null; }
async function getUserInfoData() { return {}; }
async function getDataDownloadVideo() { return null; }
async function downloadYoutubeVideo() { throw new Error('downloadYoutubeVideo not implemented'); }
async function getVideoFormatByQuality() { return null; }

// Helpers ported to Telegram (Telegraf) environment
function getMediaType(url) {
  const MEDIA_TYPES = {
    'tiktok.com': 'tiktok',
    'douyin.com': 'douyin',
    'capcut.com': 'capcut',
    'threads.net': 'threads',
    'instagram.com': 'instagram',
    'facebook.com': 'facebook',
    'fb.com': 'facebook',
    'youtube.com': 'youtube',
    'youtu.be': 'youtube',
    'twitter.com': 'twitter',
    'x.com': 'twitter',
    'vimeo.com': 'vimeo',
    'snapchat.com': 'snapchat',
    'bilibili.com': 'bilibili',
    'dailymotion.com': 'dailymotion',
    'linkedin.com': 'linkedin',
    'tumblr.com': 'tumblr',
    't.me': 'telegram',
    'pinterest.com': 'pinterest',
    'reddit.com': 'reddit'
  };
  const urlLower = (url || '').toLowerCase();
  return Object.entries(MEDIA_TYPES).find(([domain]) => urlLower.includes(domain))?.[1] || 'Unknown';
}

async function safeReply(ctx, text, opts) {
  try {
    if (opts && opts.quote) {
      // Telegram doesn't have quote param the same way; reply to message
      return await ctx.reply(text, { reply_to_message_id: ctx.message.message_id });
    }
    return await ctx.reply(text);
  } catch (e) {
    console.log('Info: safeReply failed', e && e.message);
  }
}

function extractURLFromText(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches ? matches[0] : null;
}

function textToSpeechFile(text, lang = 'vi') {
  return new Promise((resolve, reject) => {
    try {
      const tts = new gtts(text, lang);
      const fileName = `voice_${Date.now()}.mp3`;
      const filePath = path.join(tempDir, fileName);
      tts.save(filePath, (err) => {
        if (err) return reject(err);
        resolve(filePath);
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function concatenateAudios(audioPaths) {
  const outputPath = path.join(tempDir, `combined_${Date.now()}.mp3`);
  // ensure paths with spaces are properly quoted
  const quotePath = (p) => '"' + String(p).replace(/"/g, '\\"') + '"';
  const inputs = audioPaths.map(p => ['-i', quotePath(p)]).flat();
  const ffmpegCommand = [
    'ffmpeg',
    '-y',
    ...inputs,
    '-filter_complex',
    `concat=n=${audioPaths.length}:v=0:a=1[out]`,
    '-map',
    '[out]',
    '-c:a', 'libmp3lame',
    '-q:a', '2',
    quotePath(outputPath)
  ].join(' ');
  await execAsync(ffmpegCommand);
  return outputPath;
}

function detectLanguage(text) {
  const patterns = {
    vi: /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i,
    zh: /[\u4E00-\u9FFF]/,
    ja: /[\u3040-\u309F\u30A0-\u30FF]/,
    ko: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/,
  };
  const counts = {
    vi: (text.match(patterns.vi) || []).length,
    zh: (text.match(patterns.zh) || []).length,
    ja: (text.match(patterns.ja) || []).length,
    ko: (text.match(patterns.ko) || []).length,
  };
  const maxLang = Object.entries(counts).reduce((max, [lang, count]) => count > max.count ? { lang, count } : max, { lang: 'vi', count: 0 });
  if (maxLang.count === 0 && /^[\x00-\x7F]*$/.test(text)) return 'vi';
  return maxLang.count > 0 ? maxLang.lang : 'vi';
}

function splitByLanguage(text) {
  const words = text.split(' ');
  const parts = [];
  let currentPart = { text: words[0], lang: detectLanguage(words[0]) };
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const lang = detectLanguage(word);
    if (lang === currentPart.lang) currentPart.text += ' ' + word;
    else { parts.push(currentPart); currentPart = { text: word, lang }; }
  }
  parts.push(currentPart);
  return parts;
}

async function multilingualTextToSpeechFile(text) {
  const audioFiles = [];
  let finalAudioPath = null;
  try {
    const parts = splitByLanguage(text);
    for (const part of parts) {
      const filePath = await textToSpeechFile(part.text, part.lang);
      audioFiles.push(filePath);
    }
    finalAudioPath = await concatenateAudios(audioFiles);
    return finalAudioPath;
  } finally {
    // cleanup individual parts (keep final until uploaded)
    for (const f of audioFiles) try { await deleteFile(f); } catch (e) {}
  }
}

// Telegraf handler for /voice <text>
async function handleVoiceCommand(ctx) {
  const text = (ctx.message && ctx.message.text) || '';
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0] || '';
  const body = parts.slice(1).join(' ').trim();
  if (!body) return ctx.reply(`Vui lòng nhập nội dung: ${cmd} <nội dung>`);
  try {
    await ctx.reply('Đang tạo giọng nói...');
    const audioPath = await multilingualTextToSpeechFile(body);
    if (!audioPath) throw new Error('Không tạo được file audio');
    await ctx.replyWithAudio({ source: audioPath });
    await deleteFile(audioPath);
  } catch (e) {
    console.error('handleVoiceCommand error', e && e.message);
    ctx.reply('Đã có lỗi khi tạo giọng nói.');
  }
}

// Telegraf handler for /getvoice (extract audio from link or replied message)
async function handleGetVoiceCommand(ctx) {
  try {
    const message = ctx.message;
    const text = (message && message.text) || '';
    const parts = text.trim().split(/\s+/);
    const keyContent = parts.slice(1).join(' ').trim();

    let voiceUrl = null;
    let videoUrl = null;

    async function checkSocialMediaLink(url) {
      const mediaType = getMediaType(url);
      if (mediaType !== 'Unknown') {
        await safeReply(ctx, `Đang tải video từ ${mediaType}...`);
        const dataDownload = await getDataDownloadVideo(url);
        if (!dataDownload || !dataDownload.medias || dataDownload.medias.length === 0) return null;
        let bestVideo = null;
        for (const media of dataDownload.medias) {
          if (media.type.toLowerCase() === 'video') {
            if (!bestVideo || media.quality.toLowerCase().includes('hd') || media.quality.toLowerCase().includes('high')) bestVideo = media;
          }
        }
        if (bestVideo) return bestVideo.url;
        if (mediaType === 'youtube') {
          const videoId = dataDownload.url.split('?v=')[1] || (dataDownload.url.match(/youtu\.be\/([^?]+)/) || [])[1];
          if (videoId) {
            const format = await getVideoFormatByQuality(videoId, '180p');
            if (format) {
              const tmp = path.join(tempDir, `youtube_${Date.now()}.mp4`);
              await downloadYoutubeVideo(videoId, tmp, '180p');
              return tmp;
            }
          }
        }
      }
      return null;
    }

    if (keyContent) {
      const social = await checkSocialMediaLink(keyContent);
      if (social) videoUrl = social;
      else {
        const ext = await checkExstentionFileRemote(keyContent);
        if (['mp4','mov','avi','mkv','webm','flv','3gp','wmv'].includes(ext)) videoUrl = keyContent;
        else if (['aac','m4a','mp3','wav','ogg'].includes(ext)) voiceUrl = keyContent;
        else return ctx.reply('Link không được hỗ trợ hoặc không phải là video/audio.');
      }
    }

    if (message.reply_to_message && !keyContent) {
      // try to extract URL from replied message text
      const replyText = message.reply_to_message.text || '';
      const urlMatch = extractURLFromText(replyText);
      if (urlMatch) {
        const social = await checkSocialMediaLink(urlMatch);
        if (social) videoUrl = social;
        else {
          const ext = await checkExstentionFileRemote(urlMatch);
          if (['mp4','mov','avi','mkv','webm','flv','3gp','wmv'].includes(ext)) videoUrl = urlMatch;
          else if (['aac','m4a','mp3','wav','ogg'].includes(ext)) voiceUrl = urlMatch;
          else return ctx.reply('Không tìm thấy link video/audio hợp lệ trong tin nhắn được reply!');
        }
      } else return ctx.reply('Không tìm thấy link trong tin nhắn được reply!');
    }

    if (voiceUrl) {
      // send existing audio URL
      try {
        await ctx.replyWithAudio(voiceUrl);
      } catch (e) {
        await ctx.reply('Đã xảy ra lỗi khi gửi file audio.');
      }
      return;
    }

    if (videoUrl) {
      try {
        await safeReply(ctx, 'Đang xử lý video và tách âm thanh...');
        const voicePath = await extractAudioFromVideo(videoUrl, ctx, message);
        if (!voicePath) throw new Error('Không thể tách âm thanh từ video');
        await ctx.replyWithAudio({ source: voicePath });
        await deleteFile(voicePath);
      } catch (e) {
        console.error('handleGetVoiceCommand error', e && e.message);
        await ctx.reply('Đã xảy ra lỗi khi tách âm thanh.');
      }
      return;
    }

    return ctx.reply('Không có link hoặc nội dung để xử lý.');
  } catch (e) {
    console.error('handleGetVoiceCommand outer error', e && e.message);
    return ctx.reply('Đã xảy ra lỗi khi xử lý lệnh.');
  }
}

module.exports = { handleVoiceCommand, handleGetVoiceCommand };
