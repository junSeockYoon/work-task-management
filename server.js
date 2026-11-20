require('dotenv').config();

const express = require('express');
const path = require('path');
const store = require('./lib/store');
const auth = require('./lib/auth');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(express.json());
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', async (req, res) => {
  try {
    await store.ping();
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const result = await auth.signup(req.body);
    if (result.pendingConfirmation) {
      res.status(201).json({
        pendingConfirmation: true,
        email: result.email,
        message: '인증 메일을 보냈습니다. 메일함에서 확인한 뒤 로그인해 주세요.',
      });
      return;
    }
    auth.writeSession(res, result.session);
    res.status(201).json(auth.publicUser(result.user));
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const result = await auth.login(req.body);
    auth.writeSession(res, result.session);
    res.json(auth.publicUser(result.user));
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/auth/resend-confirmation', async (req, res) => {
  try {
    const result = await auth.resendConfirmation(req.body);
    res.json({
      email: result.email,
      message: '인증 메일을 다시 보냈습니다.',
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/auth/confirm', async (req, res) => {
  try {
    const result = await auth.confirmEmail(req.body);
    auth.writeSession(res, result.session);
    res.json(auth.publicUser(result.user));
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/auth/logout', (req, res) => {
  auth.clearSession(res);
  res.status(204).end();
});

app.get('/api/auth/me', requireUser, (req, res) => {
  res.json(auth.publicUser(req.user));
});

app.patch('/api/auth/me', requireUser, async (req, res) => {
  try {
    const user = await auth.updateProfile(req.user, req.body);
    res.json(auth.publicUser(user));
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/dashboard', requireUser, async (req, res) => {
  try {
    const dashboard = await store.getDashboard(req.user);
    res.json({ ...dashboard, user: auth.publicUser(req.user) });
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/tasks', requireUser, async (req, res) => {
  try {
    res.json(await store.getAll(req.user));
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/tasks', requireUser, async (req, res) => {
  try {
    const task = await store.create(req.user, req.body);
    res.status(201).json(task);
  } catch (error) {
    sendError(res, error);
  }
});

app.patch('/api/tasks/:id', requireUser, async (req, res) => {
  try {
    const task = await store.update(req.user, req.params.id, req.body);
    res.json(task);
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/tasks/:id/restore', requireUser, async (req, res) => {
  try {
    res.json(await store.restore(req.user, req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

app.delete('/api/tasks/:id', requireUser, async (req, res) => {
  try {
    await store.remove(req.user, req.params.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API를 찾을 수 없습니다.' });
});

app.get('/auth/callback', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth-callback.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'JSON 형식이 올바르지 않습니다.' });
    return;
  }
  res.status(500).json({ message: '서버 오류가 발생했습니다.' });
});

async function requireUser(req, res, next) {
  try {
    req.user = await auth.resolveUser(req, res);
    next();
  } catch (error) {
    sendError(res, error);
  }
}

function sendError(res, error) {
  const status = error.status || 500;
  const message = error.status ? error.message : '서버 오류가 발생했습니다.';
  const body = { message };
  if (error.code) body.code = error.code;
  if (error.email) body.email = error.email;
  res.status(status).json(body);
}

module.exports = app;

if (require.main === module && !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`업무일지 서버 실행 중: http://localhost:${PORT}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`포트 ${PORT}이 이미 사용 중입니다. PORT 환경 변수를 바꿔 다시 실행해 주세요.`);
      process.exit(1);
    }
    throw error;
  });
}
