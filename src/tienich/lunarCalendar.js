const { createCanvas, Image } = require('canvas');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// **ANTI-SPAM MECHANISM** - Prevent duplicate requests
const pendingRequests = new Map();
const requestCooldown = new Map();

// Vietnamese lunar calendar data
const zodiacAnimals = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
const heavenlyStems = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const weekDays = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const lunarMonthNames = ['Giêng', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười', 'Mười một', 'Chạp'];

// ======================================đm lấy=======================
// Top-level helpers for Lunar parsing & Can Chi (moved out so
// draw functions can access them). If later we refactor, avoid
// redefining inside scrape function.
// =============================================================
function extractLunarDate($, targetDate) {
  try {
    let candidates = [];
    const selectors = ['.am-lich', '.lich-am', '.lunar-date', '.lunar', '.today', '.main-date', '.detail', '.can-chi'];
    selectors.forEach(sel => {
      $(sel).each((_, el) => {
        const txt = $(el).text().trim();
        if (txt) candidates.push(txt);
      });
    });
    const raw = $('body').text().slice(0, 8000);
    if (raw) candidates.push(raw);
    const year = targetDate.getFullYear();
    const yearRange = [year - 1, year, year + 1];
    let found = null;
    const pattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;
    for (const block of candidates) {
      let m;
      while ((m = pattern.exec(block)) !== null) {
        const d = +m[1];
        const mo = +m[2];
        const y = +m[3];
        if (d >= 1 && d <= 30 && mo >= 1 && mo <= 12 && yearRange.includes(y)) {
          if (!(d === targetDate.getDate() && mo === targetDate.getMonth() + 1 && y === year)) {
            found = { day: d, month: mo, year: y };
            break;
          }
        }
      }
      if (found) break;
    }
    if (found) return found;
  } catch (e) {
    console.warn('extractLunarDate error (top-level):', e.message);
  }
  const approx = calculateLunarOffset(targetDate);
  return { day: approx.day, month: approx.month, year: approx.year };
}

const canChiAnimals = zodiacAnimals; // alias
const canChiStems = heavenlyStems;   // alias
const monthStemStartMap = { 0:2, 5:2, 1:4, 6:4, 2:6, 7:6, 3:8, 8:8, 4:0, 9:0 }; // year stem index -> month1 stem index
function toJDN(y, m, d) { if (m <= 2) { y -= 1; m += 12; } const A = Math.floor(y/100); const B = 2 - A + Math.floor(A/4); const jd = Math.floor(365.25*(y+4716)) + Math.floor(30.6001*(m+1)) + d + B - 1524.5; return Math.floor(jd + 0.5);} 
function computeCanChiDay(date){ const jdn=toJDN(date.getFullYear(), date.getMonth()+1, date.getDate()); const stemIndex=(jdn+9)%10; const branchIndex=(jdn+1)%12; return `${canChiStems[stemIndex]} ${canChiAnimals[branchIndex]}`; }
function computeCanChiMonth(yearStemIndex,lunarMonth){ const startStem=monthStemStartMap[yearStemIndex]; const stemIndex=(startStem + (lunarMonth-1))%10; const branchIndex=(lunarMonth+1)%12; return `${canChiStems[stemIndex]} ${canChiAnimals[branchIndex]}`; }
function computeCanChiYear(lunarYear){ const stemIndex=((lunarYear+6)%10+10)%10; const branchIndex=((lunarYear+8)%12+12)%12; return { stemIndex, branchIndex, name:`${canChiStems[stemIndex]} ${canChiAnimals[branchIndex]}`}; }
function buildFullCanChi(date,lunar){ const yInfo=computeCanChiYear(lunar.year); const dName=computeCanChiDay(date); const mName=computeCanChiMonth(yInfo.stemIndex,lunar.month); return { day:dName, month:mName, year:yInfo.name, full:`Ngày ${dName} tháng ${mName} năm ${yInfo.name}`}; }
function formatVietnameseSolarHeader(date){ const weekdayShort=['CN','T2','T3','T4','T5','T6','T7'][date.getDay()]; const monthNamesFull=['Một','Hai','Ba','Tư','Năm','Sáu','Bảy','Tám','Chín','Mười','Mười Một','Mười Hai']; return `${weekdayShort}, Ngày ${date.getDate()} Tháng ${monthNamesFull[date.getMonth()]} Năm ${date.getFullYear()}`; }

// **Improved Lunar Offset Calculation with Predefined Data**
function calculateLunarOffset(solarDate) {
  // Predefined lunar dates for 2025 (approximate based on historical data)
  const lunarData2025 = [
    { solar: new Date('2025-01-29'), lunar: { day: 1, month: 1, year: 2025 } }, // Tết Ất Tỵ
    { solar: new Date('2025-10-17'), lunar: { day: 15, month: 8, year: 2025 } }  // Tết Trung thu
  ];

  const diffDays = (solarDate - new Date('2025-01-29')) / (1000 * 60 * 60 * 24);
  let lunarDay = 1, lunarMonth = 1, lunarYear = 2025;

  if (diffDays >= 0 && diffDays < 365) {
    // Approximate calculation within 2025
    const baseDays = [0, 29, 59, 88, 117, 147, 176, 205, 235, 264, 294, 323, 352]; // Cumulative days for lunar months
    let totalDays = Math.floor(diffDays);
    lunarYear = 2025;

    for (let month = 1; month <= 12; month++) {
      if (totalDays <= baseDays[month]) {
        lunarMonth = month;
        lunarDay = totalDays - baseDays[month - 1] + 1;
        break;
      }
    }
    if (lunarDay > 30) {
      lunarDay -= 30;
      lunarMonth++;
      if (lunarMonth > 12) {
        lunarMonth = 1;
        lunarYear++;
      }
    }
  } else {
    // Fallback to original method for years outside 2025
    const baseDate = new Date('2025-01-29T00:00:00');
    let diff = Math.floor((solarDate - baseDate) / (1000 * 60 * 60 * 24));
    lunarDay = 1 + diff;
    lunarMonth = 1;
    lunarYear = 2025;

    const monthLengths = [29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30];
    while (lunarDay > 30) {
      lunarDay -= monthLengths[(lunarMonth - 1) % 12];
      lunarMonth++;
      if (lunarMonth > 12) {
        lunarMonth = 1;
        lunarYear++;
      }
    }
    while (lunarDay < 1) {
      lunarMonth--;
      if (lunarMonth < 1) {
        lunarMonth = 12;
        lunarYear--;
      }
      lunarDay += monthLengths[(lunarMonth - 1) % 12];
    }
  }

  return { day: Math.max(1, Math.min(30, lunarDay)), month: lunarMonth, year: lunarYear };
}

// **MAIN FUNCTION: Scrape lunar calendar data from licham.vn**
async function scrapeLunarCalendarData(date = null) {
  const targetDate = date ? new Date(date) : new Date();
  const dateStr = `${targetDate.getDate().toString().padStart(2, '0')}/${(targetDate.getMonth() + 1).toString().padStart(2, '0')}/${targetDate.getFullYear()}`;
  
  console.log(`🔄 Đang lấy dữ liệu lịch dương cho ngày: ${dateStr}`);
  
  try {
    const url = `https://licham.vn/lich-am-duong/${targetDate.getFullYear()}/${targetDate.getMonth() + 1}/${targetDate.getDate()}`;
    console.log(`📡 Đang gọi API từ: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      },
      timeout: 10000
    });

    if (response.status !== 200) {
      console.warn(`⚠️ Trả về status ${response.status}, fallback to generated data`);
      return generateFallbackLunarData(targetDate);
    }

    const $ = cheerio.load(response.data);
    
    // (Duplicate helpers removed; using top-level helpers instead)

  // Extract (or approximate) true lunar date
  const lunarExtracted = extractLunarDate($, targetDate);
  const lunarDay = lunarExtracted.day;
  const lunarMonth = lunarExtracted.month;
  const lunarYear = lunarExtracted.year;
  const lunarDateText = `${lunarDay}/${lunarMonth}/${lunarYear}`;
  const canChiData = buildFullCanChi(targetDate, lunarExtracted);

    const canChiText = $('.can-chi, .tuoi, [class*="zodiac"], [class*="can-chi"]').text().trim() ||
                      $('span, div, p').filter((i, el) => {
                        const text = $(el).text().toLowerCase();
                        return text.includes('giáp') || text.includes('ất') || text.includes('tý') || text.includes('sửu');
                      }).first().text().trim();
    
    const yearZodiac = generateZodiacInfo(targetDate);
    
    const specialDays = [];
    $('.holiday, .le-tet, .ngay-dac-biet, .su-kien, [class*="special"], [class*="holiday"]').each((i, el) => {
      const name = $(el).text().trim();
      if (name && name.length > 2 && !name.includes('Lịch')) {
        specialDays.push({ name, type: 'special' });
      }
    });
    
    $('td, div, span').filter((i, el) => {
      const text = $(el).text().toLowerCase();
      return text.includes('tết') || text.includes('lễ') || text.includes('ngày') && text.includes('quốc');
    }).each((i, el) => {
      const name = $(el).text().trim();
      if (name && name.length > 2 && specialDays.length < 5) {
        specialDays.push({ name, type: 'holiday' });
      }
    });
    
    const goodHours = [];
    $('.gio-hoang-dao, .good-hours, [class*="good-hour"], [class*="hoang-dao"]').each((i, el) => {
      const hourText = $(el).text().trim();
      const hourMatch = hourText.match(/(\w+)\s*\((\d{1,2}:\d{2})-(\d{1,2}:\d{2})\)/);
      if (hourMatch) {
        goodHours.push({ name: hourMatch[1], time: `${hourMatch[2]}-${hourMatch[3]}`, type: 'good' });
      }
    });
    
    const badHours = [];
    $('.gio-hac-dao, .bad-hours, [class*="bad-hour"], [class*="hac-dao"]').each((i, el) => {
      const hourText = $(el).text().trim();
      const hourMatch = hourText.match(/(\w+)\s*\((\d{1,2}:\d{2})-(\d{1,2}:\d{2})\)/);
      if (hourMatch) {
        badHours.push({ name: hourMatch[1], time: `${hourMatch[2]}-${hourMatch[3]}`, type: 'bad' });
      }
    });
    
    const dailyFortune = $('.loi-khuyen, .van-han, .tu-vi, [class*="fortune"], [class*="advice"]').first().text().trim() ||
                        $('.description, .note').filter((i, el) => $(el).text().length > 20).first().text().trim() ||
                        'Ngày tốt để làm việc và học tập. Hãy giữ tinh thần tích cực và sẵn sàng đón nhận những cơ hội mới.';
    
    const result = {
      solarDate: {
        day: targetDate.getDate(),
        month: targetDate.getMonth() + 1,
        year: targetDate.getFullYear(),
        weekDay: weekDays[targetDate.getDay()],
        dateStr: dateStr
      },
      lunarDate: {
        day: lunarDay,
        month: lunarMonth,
        year: lunarYear,
        monthName: lunarMonthNames[lunarMonth - 1] || `Tháng ${lunarMonth}`
      },
      zodiacInfo: yearZodiac,
      specialDays: specialDays.length > 0 ? specialDays : generateSpecialDaysFromDate(targetDate),
      upcomingEvents: generateUpcomingEvents(targetDate),
      hourlyFortune: {
        goodHours: goodHours.length > 0 ? goodHours : generateDefaultGoodHours(),
        badHours: badHours.length > 0 ? badHours : generateDefaultBadHours()
      },
      dailyFortune: dailyFortune,
      canChi: canChiData
    };
    
  console.log('✅ Lấy dữ liệu lịch dương từ licham.vn thành công');
    return result;
    
  } catch (error) {
    console.error(`❌ Lỗi scrape licham.vn: ${error.message}`);
    console.log('⚠️ Fallback to generated data');
    return generateFallbackLunarData(targetDate);
  }
}

// Generate fallback data when scraping fails
function generateFallbackLunarData(targetDate) {
  const lunarOffset = calculateLunarOffset(targetDate);
  const canChi = buildFullCanChi(targetDate, lunarOffset);
  return {
    solarDate: {
      day: targetDate.getDate(),
      month: targetDate.getMonth() + 1,
      year: targetDate.getFullYear(),
      weekDay: weekDays[targetDate.getDay()],
      dateStr: `${targetDate.getDate().toString().padStart(2, '0')}/${(targetDate.getMonth() + 1).toString().padStart(2, '0')}/${targetDate.getFullYear()}`
    },
    lunarDate: {
      day: lunarOffset.day,
      month: lunarOffset.month,
      year: lunarOffset.year,
      monthName: lunarMonthNames[lunarOffset.month - 1] || `Tháng ${lunarOffset.month}`
    },
    zodiacInfo: generateZodiacInfo(targetDate),
    specialDays: generateSpecialDaysFromDate(targetDate),
    upcomingEvents: generateUpcomingEvents(targetDate),
    hourlyFortune: {
      goodHours: generateDefaultGoodHours(),
      badHours: generateDefaultBadHours()
    },
    dailyFortune: generateDailyFortune(targetDate),
    canChi
  };
}

// Generate zodiac information
function generateZodiacInfo(date) {
  const year = date.getFullYear();
  const animalIndex = ((year - 4) % 12 + 12) % 12;
  const stemIndex = ((year - 4) % 10 + 10) % 10;
  return {
    animal: zodiacAnimals[animalIndex],
    stem: heavenlyStems[stemIndex],
    fullName: `${heavenlyStems[stemIndex]} ${zodiacAnimals[animalIndex]}`
  };
}

// Generate special days from Vietnamese holidays
function generateSpecialDaysFromDate(targetDate) {
  const events = [];
  const month = targetDate.getMonth() + 1;
  const day = targetDate.getDate();

  // Only include solar (non-lunar) holidays — ignore lunar-based holidays per request
  const holidays = getVietnameseHolidays(targetDate.getFullYear());
  holidays.forEach(h => {
    if (h.lunar) return; // skip lunar holidays
    if (h.month === month && h.day === day) events.push(h);
  });

  return events.slice(0, 5); // Limit to 5 events
}

function getVietnameseHolidays(year) {
  return [
    { name: 'Tết Dương lịch', day: 1, month: 1, type: 'national' },
    { name: 'Ngày Giỗ Tổ Hùng Vương', day: 10, month: 3, lunar: true, type: 'national' },
    { name: 'Ngày thành lập Đảng', day: 3, month: 2, type: 'national' },
    { name: 'Ngày Quốc tế Lao động', day: 1, month: 5, type: 'national' },
    { name: 'Ngày Quốc tế Thiếu nhi', day: 1, month: 6, type: 'international' },
    { name: 'Ngày Gia đình Việt Nam', day: 28, month: 6, type: 'national' },
    { name: 'Ngày Thương binh Liệt sĩ', day: 27, month: 7, type: 'national' },
    { name: 'Quốc khánh', day: 2, month: 9, type: 'national' },
    { name: 'Ngày Phụ nữ Việt Nam', day: 20, month: 10, type: 'national' },
    { name: 'Ngày Nhà giáo Việt Nam', day: 20, month: 11, type: 'national' },
    { name: 'Tết Độc lập', day: 2, month: 9, type: 'national' },
    { name: 'Tết Trung thu', day: 15, month: 8, lunar: true, type: 'lunar' },
    { name: 'Tết Nguyên Đán', day: 1, month: 1, lunar: true, type: 'lunar' }
  ];
}

// Generate upcoming events with year correction
function generateUpcomingEvents(targetDate) {
  // Compute upcoming solar events and include selected lunar festivals by
  // converting them to their next Gregorian occurrence using calculateLunarOffset.
  const solarEvents = [
    { name: 'Tết Dương lịch', month: 1, day: 1 },
    { name: 'Quốc khánh', month: 9, day: 2 },
    { name: 'Ngày Phụ nữ Việt Nam', month: 10, day: 20 },
    { name: 'Ngày Nhà giáo Việt Nam', month: 11, day: 20 },
    { name: 'Giải phóng miền Nam', month: 4, day: 30 },
    { name: 'Quốc tế Phụ nữ', month: 3, day: 8 }
  ];

  // Lunar festivals to surface (will be converted to their next solar date)
  const lunarFestivals = [
    { name: 'Tết Trung thu', lunarMonth: 8, lunarDay: 15 },
    { name: 'Tết Nguyên Đán', lunarMonth: 1, lunarDay: 1 }
  ];

  const now = new Date(targetDate);
  const currentYear = now.getFullYear();

  // helper: find next solar date whose lunar date matches given lunar month/day
  function findNextSolarForLunar(lunarMonth, lunarDay, startDate) {
    const maxDays = 400; // search window (~a bit more than a year)
    const startTs = startDate.setHours(0,0,0,0);
    for (let i = 0; i < maxDays; i++) {
      const check = new Date(startTs + i * 24 * 60 * 60 * 1000);
      try {
        const lunar = calculateLunarOffset(check);
        if (lunar && lunar.month === lunarMonth && lunar.day === lunarDay) {
          return check;
        }
      } catch (err) {
        // if calculation fails for some dates, continue
        continue;
      }
    }
    return null;
  }

  const resultList = [];

  // Add solar events
  for (const e of solarEvents) {
    const eventName = e.name;
    let target = new Date(currentYear, e.month - 1, e.day);
    if (target < now) target.setFullYear(currentYear + 1);
    const daysLeft = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    resultList.push({ name: eventName, daysLeft, targetYear: target.getFullYear() });
  }

  // Add lunar festivals by finding their next Gregorian date
  for (const lf of lunarFestivals) {
    const solar = findNextSolarForLunar(lf.lunarMonth, lf.lunarDay, new Date(now));
    if (solar) {
      const daysLeft = Math.ceil((solar - now) / (1000 * 60 * 60 * 24));
      // mark as lunar in the name
      resultList.push({ name: `${lf.name} (âm lịch)`, daysLeft, targetYear: solar.getFullYear() });
    }
  }

  // sort and dedupe
  const sorted = resultList.sort((a, b) => a.daysLeft - b.daysLeft);
  const unique = [];
  const seen = new Set();
  for (const ev of sorted) {
    if (!seen.has(ev.name) && ev.daysLeft >= 0) {
      unique.push(ev);
      seen.add(ev.name);
    }
  }
  return unique.slice(0, 7);
}

// Generate default good hours
function generateDefaultGoodHours() {
  return [
    { name: 'Tý', time: '23:00-01:00', type: 'good' },
    { name: 'Dần', time: '03:00-05:00', type: 'good' },
    { name: 'Thìn', time: '07:00-09:00', type: 'good' },
    { name: 'Ngọ', time: '11:00-13:00', type: 'good' },
    { name: 'Thân', time: '15:00-17:00', type: 'good' },
    { name: 'Tuất', time: '19:00-21:00', type: 'good' }
  ];
}

// Generate default bad hours
function generateDefaultBadHours() {
  return [
    { name: 'Sửu', time: '01:00-03:00', type: 'bad' },
    { name: 'Mão', time: '05:00-07:00', type: 'bad' },
    { name: 'Tỵ', time: '09:00-11:00', type: 'bad' },
    { name: 'Mùi', time: '13:00-15:00', type: 'bad' },
    { name: 'Dậu', time: '17:00-19:00', type: 'bad' },
    { name: 'Hợi', time: '21:00-23:00', type: 'bad' }
  ];
}

// Generate daily fortune
function generateDailyFortune(date) {
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const fortunes = [
    'Ngày thuận lợi cho công việc và học tập. Hãy tận dụng để hoàn thành các mục tiêu.',
    'Ngày tốt để gặp gỡ bạn bè, người thân. Các mối quan hệ sẽ được củng cố.',
    'Nên cẩn thận trong giao dịch tài chính. Tránh quyết định đầu tư vội vàng.',
    'Ngày tốt để bắt đầu công việc mới hoặc dự án. Vận may sẽ đồng hành.',
    'Tránh tranh cãi, giữ tinh thần thoải mái. Chú ý sức khỏe.',
    'Ngày tốt cho sáng tạo và học hỏi. Mở rộng kiến thức và kỹ năng.',
    'Dành thời gian cho gia đình và bản thân. Nghỉ ngơi để nạp năng lượng.'
  ];
  return fortunes[dayOfYear % fortunes.length];
}

// **OPTIMIZED CLEANUP FUNCTIONS**
function cleanupTempFiles() {
  const tempDir = path.resolve('./assets/temp/');
  try {
    if (!fs.existsSync(tempDir)) return;
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const maxAge = 5 * 60 * 1000;
    let deletedCount = 0;
    
    files.forEach(file => {
      if (file.startsWith('lunar_') && file.endsWith('.png')) {
        const filePath = path.join(tempDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`🧹 Đã xóa file lịch cũ: ${file}`);
          }
        } catch (err) {
          console.error(`❌ Lỗi xóa file ${file}:`, err.message);
        }
      }
    });
    
    if (deletedCount > 0) {
      console.log(`🧹 Cleanup hoàn tất: ${deletedCount} file đã được xóa`);
    }
  } catch (err) {
    console.error('❌ Lỗi cleanupTempFiles:', err.message);
  }
}

function forceDeleteFile(filePath) {
  return new Promise((resolve) => {
    const maxRetries = 3;
    let retryCount = 0;
    
    const attemptDelete = () => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Xóa file thành công: ${path.basename(filePath)}`);
          resolve(true);
        } else {
          resolve(false);
        }
      } catch (error) {
        retryCount++;
        console.warn(`⚠️ Thử xóa file lần ${retryCount}: ${error.message}`);
        if (retryCount < maxRetries) {
          setTimeout(attemptDelete, 500 * retryCount);
        } else {
          console.error(`❌ Không thể xóa file sau ${maxRetries} lần thử: ${filePath}`);
          resolve(false);
        }
      }
    };
    
    attemptDelete();
  });
}

function generateUniqueFilename() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `lunar_${timestamp}_${random}.png`;
}

function createRequestKey(date, threadId) {
  const dateStr = date ? new Date(date).toISOString().split('T')[0] : 'current';
  return `${threadId || 'default'}_${dateStr}`;
}

function isOnCooldown(requestKey) {
  const lastRequest = requestCooldown.get(requestKey);
  if (!lastRequest) return false;
  const cooldownTime = 30 * 1000;
  return (Date.now() - lastRequest) < cooldownTime;
}

function markRequest(requestKey) {
  requestCooldown.set(requestKey, Date.now());
}

async function lunarCalendarCommand(api, message, args) {
  console.log("lunarCalendarCommand được gọi:", { message, args });

  const threadId = message.threadId || message.idTo || message.data?.idTo || message.threadID;
  if (!threadId) {
    console.error("threadId không hợp lệ:", { message });
    await api.sendMessage(
      { msg: "Lỗi: Không xác định được threadId. Vui lòng thử lại." },
      message.threadID || message.data?.idTo,
      message.type || message.data?.msgType || 1
    );
    return;
  }

  let date = null;
  if (args && args.length > 0) {
    const dateInput = args.join(" ").trim();
    if (dateInput) {
      const parsedDate = parseDateInput(dateInput);
      if (parsedDate) date = parsedDate;
    }
  }
  
  console.log("Args sau khi xử lý:", { date: date ? date.toISOString() : 'today' });

  const requestKey = createRequestKey(date, threadId);
  
  const now = Date.now();
  for (const [key, timestamp] of pendingRequests.entries()) {
    if (now - timestamp > 60000) {
      console.log(`🧹 Cleanup pending request cũ: ${key}`);
      pendingRequests.delete(key);
    }
  }
  
  if (pendingRequests.has(requestKey)) {
    const requestTime = pendingRequests.get(requestKey);
    if (now - requestTime < 30000) {
      console.log("🚫 Request đang được xử lý, bỏ qua spam:", requestKey);
      return;
    } else {
      console.log("🔄 Pending request cũ, cho phép request mới:", requestKey);
      pendingRequests.delete(requestKey);
    }
  }
  
  if (isOnCooldown(requestKey)) {
    const remainingTime = Math.ceil((30 * 1000 - (Date.now() - requestCooldown.get(requestKey))) / 1000);
    await api.sendMessage(
  { msg: `⏰ Vui lòng đợi ${remainingTime}s trước khi yêu cầu lịch dương cho cùng ngày.`, ttl: 15000 },
      threadId,
      message.type || message.data?.msgType || 1
    );
    return;
  }

  pendingRequests.set(requestKey, now);
  
  let loadingMessage = null;
  try {
    loadingMessage = await api.sendMessage(
      threadId,
      message.type || message.data?.msgType || 1
    );
  } catch (loadingErr) {
    console.warn("Không thể gửi tin nhắn loading:", loadingErr.message);
  }
  
  try {
    console.log("Gọi getLunarCalendar với:", { date, threadId });
    await getLunarCalendar(api, message, threadId, date, loadingMessage);
    markRequest(requestKey);
  } catch (error) {
    console.error("❌ Lỗi trong lunarCalendarCommand:", error);
  } finally {
    pendingRequests.delete(requestKey);
    console.log("✅ Đã cleanup pending request:", requestKey);
  }
}

function parseDateInput(input) {
  const patterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
    /(\d{1,2})-(\d{1,2})-(\d{4})/
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      let day, month, year;
      if (pattern.source.startsWith('(\\d{4})')) {
        year = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        day = parseInt(match[3]);
      } else {
        day = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        year = parseInt(match[3]);
      }
      
      const date = new Date(year, month, day);
      if (date.getTime() && !isNaN(date.getTime())) return date;
    }
  }
  return null;
}

async function getLunarCalendar(api, message, threadId, date, loadingMessage = null) {
  let tempFilePath = null;
  
  try {
    console.log("Kiểm tra đầu vào:", { threadId, messageType: message.type || message.data?.msgType });
    if (!threadId || !(message.type || message.data?.msgType)) {
      throw new Error("threadId hoặc message.type không hợp lệ.");
    }

    cleanupTempFiles();

  console.log("Đang lấy dữ liệu lịch dương cho:", date ? date.toISOString().split('T')[0] : 'hôm nay');
    const lunarData = await scrapeLunarCalendarData(date);
    if (!lunarData || !lunarData.solarDate || !lunarData.lunarDate) {
  throw new Error("Dữ liệu lịch dương không hợp lệ.");
    }
  console.log("Dữ liệu lịch dương:", JSON.stringify(lunarData, null, 2));

    console.log("Đang tạo canvas...");
    const canvas = createCanvas(1280, 1920);
    const ctx = canvas.getContext('2d');
    await drawLunarCalendarCard(ctx, lunarData);

    const filename = generateUniqueFilename();
    tempFilePath = path.resolve(`./assets/temp/${filename}`);
    const dir = path.dirname(tempFilePath);
    
    if (!fs.existsSync(dir)) {
      console.log("Tạo thư mục:", dir);
      fs.mkdirSync(dir, { recursive: true });
    }

    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(tempFilePath);
      const stream = canvas.createPNGStream();
      stream.pipe(out);
      out.on('finish', () => {
        console.log("✅ Lưu ảnh thành công:", tempFilePath);
        resolve();
      });
      out.on('error', (err) => {
        console.error("❌ Lỗi lưu ảnh:", err);
        reject(err);
      });
      stream.on('error', (err) => {
        console.error("❌ Lỗi stream:", err);
        reject(err);
      });
    });

    if (!fs.existsSync(tempFilePath)) {
      throw new Error(`File không tồn tại: ${tempFilePath}`);
    }
    
    const fileSize = fs.statSync(tempFilePath).size;
    console.log("📊 File size:", fileSize, "bytes");
    
    if (fileSize === 0) {
      throw new Error("File rỗng, có lỗi khi tạo ảnh");
    }

  console.log("📤 Đang gửi ảnh...");
    const dateText = date ? date.toLocaleDateString('vi-VN') : 'hôm nay';
    
      const sendResult = await new Promise((resolve, reject) => {
      api.sendMessage(
        {
          msg: `📅 Lịch dương ${dateText}`,
          attachments: [tempFilePath],
          linkOn: false,
          ttl: 600000
        },
        threadId,
        message.type || message.data?.msgType || 1,
        (err, info) => {
          if (err) {
            console.error("❌ Lỗi gửi ảnh:", err);
            resolve({ success: false, error: err });
          } else {
            console.log("✅ Gửi ảnh thành công, info:", info);
            resolve({ success: true, info: info });
          }
        }
      );
    });

    if (tempFilePath) {
      console.log("🗑️ Đang xóa file temp ngay sau khi gửi...");
      await forceDeleteFile(tempFilePath);
    }

    if (!sendResult.success) {
      throw new Error(`Gửi ảnh thất bại: ${sendResult.error?.message || 'Unknown error'}`);
    }
    
  console.log("📤 Gửi ảnh lịch dương thành công!");

    if (loadingMessage) {
      try {
        setTimeout(async () => {
          try {
            await api.deleteMessage(loadingMessage, true);
            console.log("✅ Đã xóa tin nhắn loading");
          } catch (deleteErr) {
            console.warn("Không thể xóa tin nhắn loading:", deleteErr.message);
          }
        }, 1000);
      } catch (deleteErr) {
        console.warn("Lỗi setup xóa tin nhắn loading:", deleteErr.message);
      }
    }

  } catch (error) {
    console.error("❌ Lỗi trong getLunarCalendar:", error);
    
    if (tempFilePath) {
      console.log("🗑️ Đang xóa file temp do lỗi...");
      await forceDeleteFile(tempFilePath);
    }
    
    if (loadingMessage) {
      try {
        await api.deleteMessage(loadingMessage, true);
        console.log("✅ Đã xóa tin nhắn loading do lỗi");
      } catch (deleteErr) {
        console.warn("Không thể xóa tin nhắn loading:", deleteErr.message);
      }
    }
    
  let errorMessage = "Đã xảy ra lỗi khi tạo lịch dương. Vui lòng thử lại sau.";
    if (error.message?.includes('Timeout')) {
  errorMessage = "⏰ Gửi ảnh lịch dương mất quá nhiều thời gian. Vui lòng thử lại sau.";
    } else if (error.message?.includes('network') || error.message?.includes('ENOTFOUND')) {
      errorMessage = "🌐 Lỗi kết nối mạng. Vui lòng kiểm tra kết nối và thử lại.";
    } else if (error.message?.includes('Canvas') || error.message?.includes('Image')) {
  errorMessage = "🎨 Lỗi tạo ảnh lịch dương. Vui lòng thử lại sau.";
    }
    
    try {
      await api.sendMessage(
        { msg: errorMessage, quote: message, ttl: 30000 },
        threadId,
        message.type || message.data?.msgType || 1
      );
      console.log("✅ Gửi tin nhắn lỗi thành công.");
    } catch (sendError) {
      console.error("❌ Lỗi khi gửi tin nhắn lỗi:", sendError);
    }
  } finally {
    setTimeout(() => {
      console.log("🧹 Chạy cleanup cuối cùng...");
      cleanupTempFiles();
    }, 2000);
  }
}

async function getLunarCalendarBackground() {
  const backgroundUrls = [
    'https://picsum.photos/1280/1920/?blur=2',
    'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1280&h=1920&fit=crop',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1280&h=1920&fit=crop'
  ];
  
  for (const url of backgroundUrls) {
    try {
      console.log(`Đang thử tải background từ: ${url}`);
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/webp,image/*,*/*;q=0.8'
        }
      });
      if (response.status === 200) {
        console.log(`Tải background thành công từ: ${url}`);
        return response.data;
      }
    } catch (error) {
      console.error(`Lỗi tải background từ ${url}: ${error.message}`);
    }
  }
  
  console.log("Không thể tải background từ bất kỳ URL nào, sử dụng fallback");
  return null;
}

function loadImageFromBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    try {
      const base64 = buffer.toString('base64');
      img.src = `data:image/jpeg;base64,${base64}`;
    } catch (convertError) {
      reject(convertError);
    }
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Simple word-wrap helper: draws multiline text within maxWidth, returns number of lines drawn
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  if (!text) return 0;
  const paragraphs = String(text).split('\n');
  let linesDrawn = 0;
  for (let p = 0; p < paragraphs.length; p++) {
    const words = paragraphs[p].split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = line ? line + ' ' + words[n] : words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = words[n];
        y += lineHeight;
        linesDrawn++;
      } else {
        line = testLine;
      }
    }
    if (line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      linesDrawn++;
    }
    // add extra spacing between paragraphs
    y += lineHeight * 0.25;
  }
  return linesDrawn;
}

// --- Minimal helper implementations so the renderer can run ---
async function renderBackground(ctx) {
  try {
    const buf = await getLunarCalendarBackground();
    if (buf) {
      try {
        const img = await loadImageFromBuffer(Buffer.from(buf));
        ctx.drawImage(img, 0, 0, 1280, 1920);
        // strong dark overlay to match the mock's very dark aesthetic
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, 1280, 1920);
        return;
      } catch (e) {
        console.warn('renderBackground: failed to load background image:', e.message);
      }
    }
  } catch (e) {
    console.warn('renderBackground error:', e.message);
  }
  // fallback: very dark gradient matching the mock
  const g = ctx.createLinearGradient(0, 0, 0, 1920);
  g.addColorStop(0, '#1a1a1a');
  g.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1280, 1920);
}

function drawGlassPanel(ctx, x, y, w, h, radius, opts = {}) {
  const fill = opts.fill || 'rgba(255,255,255,0.06)';
  const border = opts.border || 'rgba(255,255,255,0.2)';
  const gradient = opts.gradient || ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)'];
  // background
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, gradient[0]);
  g.addColorStop(1, gradient[1]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  // border
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = border;
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.stroke();
  ctx.restore();
}

function drawCombinedTopPanel(ctx, lunarData, x, y, width) {
  // Redesigned top panel to match the mock:
  // - header (weekday + solar) top-left
  // - huge centered day and small lunar line under it
  // - can-chi phrase aligned to top-right
  const padding = 36;
  const leftX = x + padding;
  const rightX = x + width - padding;
  const centerX = x + width / 2;
  const topY = y;

  const solar = lunarData.solarDate || {};
  const lunar = lunarData.lunarDate || {};

  // Header (top-left)
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = '700 34px "Be Vietnam Pro", "Roboto"';
  ctx.fillText(solar.weekDay || '', leftX, topY + 42);
  ctx.font = '500 20px "Roboto"';
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.fillText(`${String(solar.day).padStart(2,'0')}/${String(solar.month).padStart(2,'0')}/${solar.year || ''}`, leftX, topY + 72);

  // Top-right Can Chi
  ctx.textAlign = 'right';
  ctx.font = '600 18px "Roboto"';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const canchi = lunarData.canChi?.full || `${lunarData.zodiacInfo?.fullName || ''}`;
  ctx.fillText(canchi, rightX, topY + 56);
  ctx.restore();

  // Center big day
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  // big day number
  ctx.font = '900 200px "Be Vietnam Pro", "Roboto"';
  const dayStr = String(lunarData.solarDate?.day || solar.day || '?').padStart(2,'0');
  // draw subtle drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 32;
  ctx.fillText(dayStr, centerX, topY + 150);
  ctx.shadowBlur = 0;

  // small lunar line under the big day
  ctx.font = '600 24px "Be Vietnam Pro", "Roboto"';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText(`${lunar.day || ''} ${lunar.monthName || ''} ${lunar.year || ''}`, centerX, topY + 200);
  ctx.restore();

  return topY + 220; // new y cursor after top area (compact)
}

function drawEventsRow(ctx, lunarData, x, y, width) {
  // Tight two-column events area with clear headers
  const leftX = x + 60;
  const colW = Math.floor((width - 200) / 2);
  const leftColX = leftX;
  const rightColX = leftX + colW + 48;
  const lineH = 34;

  const specials = (lunarData.specialDays || []).slice(0,6);
  const upcoming = (lunarData.upcomingEvents || []).slice(0,6);

  ctx.save();
  ctx.font = '600 20px "Be Vietnam Pro", "Roboto"';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText('Sự kiện', leftColX, y + 28);
  ctx.fillText('Sự kiện (âm/dương)', rightColX, y + 28);

  ctx.font = '400 18px "Roboto"';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  for (let i = 0; i < Math.max(specials.length, 1); i++) {
    const ev = specials[i];
    const txt = ev ? `• ${ev.name}` : '• —';
    ctx.fillText(txt, leftColX, y + 60 + i * lineH);
  }
  for (let i = 0; i < Math.max(upcoming.length, 1); i++) {
    const ev = upcoming[i];
    const txt = ev ? `• ${ev.name || ev}` : '• —';
    ctx.fillText(txt, rightColX, y + 60 + i * lineH);
  }
  ctx.restore();

  const rows = Math.max(specials.length, upcoming.length, 1);
  return y + 60 + rows * lineH + 10;
}

function drawHoursRow(ctx, lunarData, x, y, width) {
  // Hours lists with slightly larger spacing
  const leftX = x + 60;
  const colW = Math.floor((width - 200) / 2);
  const rightX = leftX + colW + 48;
  const good = lunarData.hourlyFortune?.goodHours || [];
  const bad = lunarData.hourlyFortune?.badHours || [];
  const rows = Math.max(good.length, bad.length, 1);
  ctx.save();
  ctx.font = '600 20px "Be Vietnam Pro", "Roboto"'; ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText('Giờ Hoàng', leftX, y + 28);
  ctx.fillText('Giờ Hắc', rightX, y + 28);
  ctx.font = '400 18px "Roboto"'; ctx.fillStyle = 'rgba(255,255,255,0.88)';
  for (let i = 0; i < rows; i++) {
    if (good[i]) ctx.fillText(`• ${good[i].name} ${good[i].time || ''}`, leftX, y + 60 + i * 34);
    if (bad[i]) ctx.fillText(`• ${bad[i].name} ${bad[i].time || ''}`, rightX, y + 60 + i * 34);
  }
  ctx.restore();
  return y + 60 + rows * 34 + 10;
}

function drawAdviceFooter(ctx, lunarData, x, y, width, height) {
  // Big horizontal advice strip spanning card width
  const pad = 48;
  const left = x + pad; const top = y + 10;
  ctx.save();
  // soft translucent panel
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  drawRoundedRect(ctx, left - 12, top - 8, width - pad*2 + 24, height - 16, 18);
  ctx.fill();

  ctx.font = '700 22px "Be Vietnam Pro", "Roboto"';
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.textAlign = 'left';
  const txt = lunarData.dailyFortune || generateDailyFortune(new Date());
  // wrap with larger line height
  const maxW = width - pad*2 - 20;
  const lh = 34;
  const words = txt.split(' ');
  let line = ''; let curY = top + 28;
  ctx.font = '600 22px "Roboto"'; ctx.fillStyle = 'rgba(255,255,255,0.95)';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, left, curY);
      line = w; curY += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, left, curY);
  ctx.restore();
}

// ===================== EXACT MOCK MATCH RENDERER ===================== //
async function drawLunarCalendarCard(ctx, lunarData) {
  // Match the attached image exactly: dark bg, rounded dark card with subtle border,
  // huge "14" centered top, "24 Chín 2025" below, left column header/events/hours,
  // right column header/events/hours, advice text at bottom, watermark bottom-right
  ctx.clearRect(0, 0, 1280, 1920);
  await renderBackground(ctx);

  const CARD_PAD = 32;
  const CARD_X = CARD_PAD;
  const CARD_Y = CARD_PAD;
  const CARD_W = 1280 - CARD_PAD * 2;
  const CARD_H = 1920 - CARD_PAD * 2;
  const CARD_RADIUS = 32;

  // Dark card background with subtle border (matching mock's dark aesthetic)
  ctx.save();
  drawRoundedRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, CARD_RADIUS);
  ctx.fillStyle = 'rgba(30,30,30,0.85)'; // darker translucent card
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.stroke();
  ctx.restore();

  const INNER_PAD = 48;
  const contentLeft = CARD_X + INNER_PAD;
  const contentRight = CARD_X + CARD_W - INNER_PAD;
  const contentTop = CARD_Y + INNER_PAD;
  const centerX = CARD_X + CARD_W / 2;

  // TOP LEFT: Weekday and small date (Thứ ba, 14/10/2025)
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 24px "Be Vietnam Pro", "Roboto"';
  ctx.fillText(lunarData.solarDate?.weekDay || 'Thứ ba', contentLeft, contentTop + 24);
  ctx.font = '400 16px "Roboto"';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`${String(lunarData.solarDate?.day).padStart(2,'0')}/${String(lunarData.solarDate?.month).padStart(2,'0')}/${lunarData.solarDate?.year || ''}`, contentLeft, contentTop + 48);
  ctx.restore();

  // TOP RIGHT: Can Chi text (Ngày Bính Thìn tháng Bính Tuất năm Ất Tỵ)
  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = '400 14px "Roboto"';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const canChiText = lunarData.canChi?.full || lunarData.zodiacInfo?.fullName || '';
  // word-wrap can-chi if too long
  const maxCanChiW = 380;
  const canChiWords = canChiText.split(' ');
  let canChiLine1 = '', canChiLine2 = '';
  for (const w of canChiWords) {
    const test = canChiLine1 ? `${canChiLine1} ${w}` : w;
    if (ctx.measureText(test).width > maxCanChiW && canChiLine1) {
      canChiLine2 = canChiLine2 ? `${canChiLine2} ${w}` : w;
    } else canChiLine1 = test;
  }
  ctx.fillText(canChiLine1, contentRight, contentTop + 28);
  if (canChiLine2) ctx.fillText(canChiLine2, contentRight, contentTop + 48);
  ctx.restore();

  // HUGE CENTERED DAY NUMBER (like "14" in the image)
  const bigDayY = contentTop + 180;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '900 280px "Be Vietnam Pro", "Roboto"';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 24;
  ctx.fillText(String(lunarData.solarDate?.day || '14'), centerX, bigDayY);
  ctx.shadowBlur = 0;
  ctx.restore();

  // Lunar date line below big day (e.g., "24 Chín 2025")
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '600 26px "Be Vietnam Pro", "Roboto"';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${lunarData.lunarDate?.day || ''} ${lunarData.lunarDate?.monthName || ''} ${lunarData.lunarDate?.year || ''}`, centerX, bigDayY + 60);
  ctx.restore();

  // TWO-COLUMN LAYOUT starting below the big day
  const colStartY = bigDayY + 120;
  const colMidX = centerX;
  const leftColX = contentLeft;
  const rightColX = colMidX + 40;
  const colLineH = 28;

  // LEFT COLUMN: "Sự kiện" header + list
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '700 20px "Be Vietnam Pro", "Roboto"';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Sự kiện', leftColX, colStartY);
  ctx.font = '400 16px "Roboto"';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const leftEvents = lunarData.specialDays && lunarData.specialDays.length ? lunarData.specialDays : [{ name: '—' }];
  for (let i = 0; i < leftEvents.length && i < 7; i++) {
    const ev = leftEvents[i];
    ctx.fillText(`• ${ev.name || ev}`, leftColX, colStartY + 36 + i * colLineH);
  }
  ctx.restore();

  // RIGHT COLUMN: "Sự kiện (âm/dương)" header + list
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '700 20px "Be Vietnam Pro", "Roboto"';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Sự kiện (âm/dương)', rightColX, colStartY);
  ctx.font = '400 16px "Roboto"';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const rightEvents = lunarData.upcomingEvents && lunarData.upcomingEvents.length ? lunarData.upcomingEvents : [];
  for (let i = 0; i < rightEvents.length && i < 7; i++) {
    const ev = rightEvents[i];
    ctx.fillText(`• ${ev.name || ev}`, rightColX, colStartY + 36 + i * colLineH);
  }
  ctx.restore();

  // HOURS SECTION (below events)
  const hoursStartY = colStartY + Math.max(leftEvents.length, rightEvents.length, 1) * colLineH + 72;
  
  // LEFT: "Giờ Hoàng"
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '700 18px "Be Vietnam Pro", "Roboto"';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Giờ Hoàng', leftColX, hoursStartY);
  ctx.font = '400 15px "Roboto"';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const goodHours = lunarData.hourlyFortune?.goodHours || [];
  for (let i = 0; i < goodHours.length && i < 6; i++) {
    const h = goodHours[i];
    ctx.fillText(`• ${h.name} ${h.time || ''}`, leftColX, hoursStartY + 32 + i * 26);
  }
  ctx.restore();

  // RIGHT: "Giờ Hắc"
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '700 18px "Be Vietnam Pro", "Roboto"';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Giờ Hắc', rightColX, hoursStartY);
  ctx.font = '400 15px "Roboto"';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const badHours = lunarData.hourlyFortune?.badHours || [];
  for (let i = 0; i < badHours.length && i < 6; i++) {
    const h = badHours[i];
    ctx.fillText(`• ${h.name} ${h.time || ''}`, rightColX, hoursStartY + 32 + i * 26);
  }
  ctx.restore();

  // ADVICE TEXT (bottom area, left-aligned like the mock)
  const adviceStartY = hoursStartY + Math.max(goodHours.length, badHours.length, 1) * 26 + 64;
  const adviceBottomY = CARD_Y + CARD_H - 80;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = '400 16px "Roboto"';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const adviceText = lunarData.dailyFortune || generateDailyFortune(new Date());
  wrapText(ctx, adviceText, contentLeft, adviceStartY, CARD_W - INNER_PAD * 2, 24);
  ctx.restore();

  // WATERMARK (bottom-right)
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.textAlign = 'right';
  ctx.font = '600 14px "Roboto"';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('© xAI Calendar', contentRight, CARD_Y + CARD_H - 24);
  ctx.restore();
}

// ... rest of drawing helper functions remain unchanged (kept above)

// The file already contains all draw helpers and functions above. Export the main functions.
// Generate an image file for a given date and return the file path.
async function generateLunarCalendarImage(date = null) {
  try {
    const targetDate = date ? new Date(date) : new Date();
    console.log('📸 Generating lunar calendar image for', targetDate.toISOString().split('T')[0]);

    const lunarData = await scrapeLunarCalendarData(targetDate);
    if (!lunarData) throw new Error('No lunar data available');

    const canvas = createCanvas(1280, 1920);
    const ctx = canvas.getContext('2d');
    await drawLunarCalendarCard(ctx, lunarData);

    const filename = generateUniqueFilename();
    const tempFilePath = path.resolve(`./assets/temp/${filename}`);
    const dir = path.dirname(tempFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(tempFilePath);
      const stream = canvas.createPNGStream();
      stream.pipe(out);
      out.on('finish', resolve);
      out.on('error', reject);
      stream.on('error', reject);
    });

    if (!fs.existsSync(tempFilePath)) throw new Error('Failed to create image file');
    return tempFilePath;
  } catch (err) {
    console.error('❌ generateLunarCalendarImage error:', err.message);
    throw err;
  }
}
module.exports = {
  lunarCalendarCommand,
  scrapeLunarCalendarData,
  cleanupTempFiles,
  drawLunarCalendarCard,
  getLunarCalendar,
  generateLunarCalendarImage,
  forceDeleteFile
};
