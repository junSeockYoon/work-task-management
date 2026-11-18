require('dotenv').config();

const express = require('express');
const path = require('path');
const store = require('./lib/store');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(express.json());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
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

app.get('/api/dashboard', async (req, res) => {
  try {
    res.json(await store.getDashboard());
  } catch (error) {
    sendError(res, error);
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    res.json(await store.getAll());
  } catch (error) {
    sendError(res, error);
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const task = await store.create(req.body);
    res.status(201).json(task);
  } catch (error) {
    sendError(res, error);
  }
});

app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const task = await store.update(req.params.id, req.body);
    res.json(task);
  } catch (error) {
    sendError(res, error);
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await store.remove(req.params.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API를 찾을 수 없습니다.' });
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

function sendError(res, error) {
  const status = error.status || 500;
  const message = error.status ? error.message : '서버 오류가 발생했습니다.';
  res.status(status).json({ message });
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
