// Debug helper for fetchPhatNguoiSite
// Usage: node src/tienich/debug_fetch.js 62N123441

const helper = require('./checkphatnguoi');
const axios = require('axios');

(async () => {
  const plate = process.argv[2] || '62N123441';
  console.log('Debug fetch for plate:', plate);
  try {
    const result = await helper.fetchPhatNguoiSite(plate);
    console.log('Helper result:\n', JSON.stringify(result, null, 2));

    // Retrieve raw HTML to inspect context
    const url = `https://phatnguoi.com/?s=${encodeURIComponent(plate)}`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 15000,
    });
    const html = String(res.data || '');
    const htmlLower = html.toLowerCase();
    const plateNorm = plate.toLowerCase().replace(/\s+/g, '');
    let idx = htmlLower.indexOf(plateNorm);
    if (idx === -1) idx = htmlLower.indexOf(plate.toLowerCase());
    if (idx === -1) {
      console.log('\nPlate string not found in HTML. Showing page head (first 800 chars):\n');
      console.log(html.slice(0, 800));
    } else {
      const start = Math.max(0, idx - 400);
      const end = Math.min(html.length, idx + 400);
      console.log(`\nHTML snippet around plate (index ${idx}):\n`);
      console.log(html.slice(start, end));
    }

  } catch (err) {
    console.error('Debug fetch error:', err && (err.message || err));
    process.exit(1);
  }
})();
