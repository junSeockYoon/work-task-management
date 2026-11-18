const { admin, authClient } = require('./supabase');

const ACCESS_COOKIE = 'wl_access';
const REFRESH_COOKIE = 'wl_refresh';
const REFRESH_MAX_AGE = 60 * 60 * 24 * 60;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function emailFor(username) {
  return `${username}@member.worklog.app`;
}

function readUsername(value) {
  if (typeof value !== 'string') {
    throw httpError(400, '아이디를 입력해 주세요.');
  }
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9_]{4,20}$/.test(username)) {
    throw httpError(400, '아이디는 영문 소문자, 숫자, 밑줄(_)만 사용해 4~20자로 입력해 주세요.');
  }
  return username;
}

function readPassword(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw httpError(400, '비밀번호는 8자 이상으로 입력해 주세요.');
  }
  if (value.length > 72) {
    throw httpError(400, '비밀번호는 72자 이내로 입력해 주세요.');
  }
  return value;
}

function readPhone(value) {
  if (typeof value !== 'string') {
    throw httpError(400, '전화번호를 입력해 주세요.');
  }
  const phone = value.replace(/\D/g, '');
  if (!/^01\d{8,9}$/.test(phone)) {
    throw httpError(400, '전화번호는 01로 시작하는 10~11자리 숫자로 입력해 주세요.');
  }
  return phone;
}

function cookieBase() {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL ? '; Secure' : '';
  return `HttpOnly; Path=/; SameSite=Lax${secure}`;
}

function readCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    const raw = part.slice(index + 1).trim();
    try {
      cookies[key] = decodeURIComponent(raw);
    } catch {
      cookies[key] = raw;
    }
  }
  return cookies;
}

function writeSession(res, session) {
  const accessMax = Number(session.expires_in) > 0 ? Number(session.expires_in) : 3600;
  res.setHeader('Set-Cookie', [
    `${ACCESS_COOKIE}=${encodeURIComponent(session.access_token)}; ${cookieBase()}; Max-Age=${accessMax}`,
    `${REFRESH_COOKIE}=${encodeURIComponent(session.refresh_token)}; ${cookieBase()}; Max-Age=${REFRESH_MAX_AGE}`,
  ]);
}

function clearSession(res) {
  res.setHeader('Set-Cookie', [
    `${ACCESS_COOKIE}=; ${cookieBase()}; Max-Age=0`,
    `${REFRESH_COOKIE}=; ${cookieBase()}; Max-Age=0`,
  ]);
}

function publicUser(user) {
  return { username: user.username, phone: user.phone };
}

async function findProfileByUsername(username) {
  const { data, error } = await admin.from('profiles').select('id, username, phone').eq('username', username).maybeSingle();
  if (error) throw profileStoreError(error, 'load');
  return data;
}

async function loadProfile(id) {
  const { data, error } = await admin.from('profiles').select('id, username, phone').eq('id', id).maybeSingle();
  if (error) throw profileStoreError(error, 'load');
  return data;
}

function profileStoreError(error, action) {
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return httpError(503, '회원 테이블이 없습니다. Supabase SQL 편집기에서 supabase/auth.sql 을 실행해 주세요.');
  }
  if (error.code === '23505') return httpError(409, '이미 사용 중인 아이디입니다.');
  if (error.code === '23514') return httpError(400, '아이디 또는 전화번호 형식이 올바르지 않습니다.');
  return httpError(503, action === 'save' ? '회원 정보를 저장하지 못했습니다.' : '회원 정보를 불러오지 못했습니다.');
}

async function userFromAccess(accessToken) {
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  const profile = await loadProfile(data.user.id);
  if (!profile) return null;
  return {
    id: profile.id,
    username: profile.username,
    phone: profile.phone,
    accessToken,
  };
}

async function refreshSession(refreshToken) {
  const { data, error } = await authClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return null;
  return data.session;
}

async function resolveUser(req, res) {
  const cookies = readCookies(req);
  if (cookies[ACCESS_COOKIE]) {
    const user = await userFromAccess(cookies[ACCESS_COOKIE]);
    if (user) return user;
  }
  if (cookies[REFRESH_COOKIE]) {
    const session = await refreshSession(cookies[REFRESH_COOKIE]);
    if (session) {
      writeSession(res, session);
      const user = await userFromAccess(session.access_token);
      if (user) return user;
    }
  }
  throw httpError(401, '로그인이 필요합니다.');
}

async function signup(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, '요청 본문이 올바르지 않습니다.');
  }
  const username = readUsername(body.username);
  const password = readPassword(body.password);
  const phone = readPhone(body.phone);

  const existing = await findProfileByUsername(username);
  if (existing) throw httpError(409, '이미 사용 중인 아이디입니다.');

  const { data, error } = await admin.auth.admin.createUser({
    email: emailFor(username),
    password,
    email_confirm: true,
    user_metadata: { username, phone },
  });
  if (error || !data.user) {
    const duplicate = error && /already|registered|exists/i.test(error.message || '');
    throw httpError(duplicate ? 409 : 400, duplicate ? '이미 사용 중인 아이디입니다.' : '회원가입에 실패했습니다.');
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    username,
    phone,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw profileStoreError(profileError, 'save');
  }

  const signed = await authClient().auth.signInWithPassword({
    email: emailFor(username),
    password,
  });
  if (signed.error || !signed.data.session) {
    throw httpError(500, '가입은 되었지만 로그인에 실패했습니다. 같은 아이디로 다시 로그인해 주세요.');
  }

  return {
    session: signed.data.session,
    user: { id: data.user.id, username, phone, accessToken: signed.data.session.access_token },
  };
}

async function login(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, '요청 본문이 올바르지 않습니다.');
  }
  const username = readUsername(body.username);
  const password = readPassword(body.password);
  const profile = await findProfileByUsername(username);
  const signed = await authClient().auth.signInWithPassword({
    email: emailFor(username),
    password,
  });
  if (!profile || signed.error || !signed.data.session) {
    throw httpError(401, '아이디 또는 비밀번호가 올바르지 않습니다.');
  }
  return {
    session: signed.data.session,
    user: {
      id: profile.id,
      username: profile.username,
      phone: profile.phone,
      accessToken: signed.data.session.access_token,
    },
  };
}

module.exports = {
  signup,
  login,
  resolveUser,
  writeSession,
  clearSession,
  publicUser,
};
