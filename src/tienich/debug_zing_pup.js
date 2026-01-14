const { searchMusicZingPuppeteer } = require('../commands/music/index.js');

(async () => {
  const q = process.argv.slice(2).join(' ') || 'Em Gái Mưa';
  console.log('Query:', q);
  try {
    const res = await searchMusicZingPuppeteer(q, 12);
    console.log('Result ok:', res && res.ok);
    console.log('Items:', JSON.stringify(res.data || res, null, 2));
  } catch (e) {
    console.error('ERR', e && e.message);
  }
})();
