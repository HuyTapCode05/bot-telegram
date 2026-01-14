const fs = require('fs');
const path = require('path');

const statePath = path.join(__dirname, 'bot_state.json');
let projectConfig = {};
try { projectConfig = require('../../config.json'); } catch (e) { projectConfig = {}; }

function getSuperAdmins() {
  return Array.isArray(projectConfig.superAdmins) ? projectConfig.superAdmins.map(String) : [];
}

function isSuperAdmin(uid) {
  const list = getSuperAdmins();
  return list.includes(String(uid));
}

function load() {
  try {
    if (!fs.existsSync(statePath)) return {};
    const raw = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) { return {}; }
}

function save(obj) {
  try {
    fs.writeFileSync(statePath, JSON.stringify(obj, null, 2), 'utf8');
    return true;
  } catch (e) { return false; }
}

function getBotState(chatId) {
  const s = load();
  return !!s[String(chatId)];
}

function setBotState(chatId, enabled) {
  const s = load();
  s[String(chatId)] = !!enabled;
  return save(s);
}

module.exports = { getBotState, setBotState, statePath, getSuperAdmins, isSuperAdmin };
