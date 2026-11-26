const crypto = require('crypto');

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '30m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const REFRESH_COOKIE_NAME = 'simpro_refresh_token';

function getJwtSecret() {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET belum dikonfigurasi di environment (.env)');
    }
    return process.env.JWT_SECRET;
}

function getJwtRefreshSecret() {
    if (!process.env.JWT_REFRESH_SECRET) {
        throw new Error('JWT_REFRESH_SECRET belum dikonfigurasi di environment (.env)');
    }
    return process.env.JWT_REFRESH_SECRET;
}

function hashToken(rawToken) {
    return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function getRefreshCookieOptions(req) {
    const isHttps =
        Boolean(req?.secure) ||
        req?.headers?.['x-forwarded-proto'] === 'https' ||
        process.env.NODE_ENV === 'production';

    const secureEnv = String(process.env.COOKIE_SECURE || '').trim().toLowerCase();
    let secure = secureEnv === 'true' ? true : secureEnv === 'false' ? false : isHttps;

    const defaultSameSite = secure ? 'none' : 'lax';
    const sameSiteRaw = String(process.env.COOKIE_SAMESITE || defaultSameSite)
        .trim()
        .toLowerCase();
    const sameSite = ['strict', 'lax', 'none'].includes(sameSiteRaw)
        ? sameSiteRaw
        : defaultSameSite;

    // Browser modern mewajibkan Secure=true apabila SameSite=none
    if (sameSite === 'none') {
        secure = true;
    }

    return {
        httpOnly: true,
        secure,
        sameSite,
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari dalam milidetik
    };
}

module.exports = {
    ACCESS_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_IN,
    REFRESH_COOKIE_NAME,
    getJwtSecret,
    getJwtRefreshSecret,
    hashToken,
    getRefreshCookieOptions,
};