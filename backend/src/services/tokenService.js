const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  getJwtSecret,
  getJwtRefreshSecret,
  hashToken,
} = require('../config/auth');

function parseDurationToMs(durationStr, fallbackMs) {
  if (typeof durationStr === 'number' && Number.isFinite(durationStr)) {
    return durationStr * 1000;
  }
  const str = String(durationStr || '').trim();
  const match = str.match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return fallbackMs;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * (multipliers[unit] || 1000);
}

function buildAccessToken(user) {
  const secret = getJwtSecret();
  const payload = {
    id: user.id,
    nama: user.nama,
    email: user.email,
    posisi: user.posisi,
    role: user.posisi,
    type: 'access',
  };

  const accessToken = jwt.sign(payload, secret, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

  const expiresInMs = parseDurationToMs(ACCESS_TOKEN_EXPIRES_IN, 30 * 60 * 1000);
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();

  return {
    accessToken,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    expiresAt,
  };
}

function buildRefreshToken(user) {
  const refreshSecret = getJwtRefreshSecret();
  const jti = crypto.randomBytes(16).toString('hex');

  const payload = {
    id: user.id,
    email: user.email,
    type: 'refresh',
    jti,
  };

  const refreshToken = jwt.sign(payload, refreshSecret, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });

  const tokenHash = hashToken(refreshToken);
  const expiresInMs = parseDurationToMs(
    REFRESH_TOKEN_EXPIRES_IN,
    7 * 24 * 60 * 60 * 1000
  );
  const expiresAtDate = new Date(Date.now() + expiresInMs);

  return {
    refreshToken,
    tokenHash,
    expiresAtDate,
  };
}

function verifyRefreshToken(rawToken) {
  const refreshSecret = getJwtRefreshSecret();
  const decoded = jwt.verify(String(rawToken), refreshSecret);
  if (decoded?.type && decoded.type !== 'refresh') {
    throw new Error('Tipe token bukan refresh token');
  }
  return decoded;
}

module.exports = {
  buildAccessToken,
  buildRefreshToken,
  verifyRefreshToken,
};
