const jwt = require('jsonwebtoken');
const {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  getJwtSecret,
  getJwtRefreshSecret,
  hashToken,
} = require('../config/auth');

function buildAccessToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.posisi || user.role,
    posisi: user.posisi || user.role,
  };

  const token = jwt.sign(payload, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

  const decoded = jwt.decode(token);
  return {
    accessToken: token,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    expiresAt: decoded?.exp ? decoded.exp * 1000 : Date.now() + 30 * 60 * 1000,
  };
}

function buildRefreshToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    type: 'refresh',
  };

  const token = jwt.sign(payload, getJwtRefreshSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });

  const decoded = jwt.decode(token);
  const expiresAtDate = decoded?.exp
    ? new Date(decoded.exp * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return {
    refreshToken: token,
    tokenHash: hashToken(token),
    expiresAtDate,
  };
}

function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret());
}

function verifyRefreshToken(token) {
  return jwt.verify(token, getJwtRefreshSecret());
}

module.exports = {
  buildAccessToken,
  buildRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};