// Lưu session đăng nhập (chạy trong RAM)
const sessions = {};

function login(userId, username) {
  sessions[userId] = username;
}

function logout(userId) {
  delete sessions[userId];
}

function getSession(userId) {
  return sessions[userId];
}

function isLoggedIn(userId) {
  return sessions[userId] !== undefined;
}

module.exports = { login, logout, getSession, isLoggedIn };
