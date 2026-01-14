const axios = require('axios');

async function run() {
  const q = process.argv.slice(2).join(' ') || 'Em Gái Mưa';
  try {
    console.log('Query:', q);
    const url = 'https://zingmp3.vn/tim-kiem/tat-ca?q=' + encodeURIComponent(q);
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 15000 });
    const html = String(res.data || '');
    const links = [];
    const re = /href=\"([^\"]*\/bai-hat\/[^\"]*)\"/g;
    let m;
    while ((m = re.exec(html)) && links.length < 20) {
      links.push(m[1]);
    }
    console.log('Found', links.length, '/bai-hat/ links');
    links.slice(0, 20).forEach((l, i) => console.log(i + 1, l));

    if (links.length > 0) {
      const idx = html.indexOf(links[0]);
      const start = Math.max(0, idx - 300);
      const end = Math.min(html.length, idx + 300);
      console.log('\n--- snippet around first match ---\n');
      console.log(html.slice(start, end));
    } else {
      console.log('\n--- page head (first 4000 chars) ---\n');
      console.log(html.slice(0, 4000));
    }
  } catch (e) {
    console.error('ERR', e && e.message);
  }
}

run();
