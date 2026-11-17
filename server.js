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

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/dashboard', (req, res) => {
  res.json(store.getDashboard());
});

app.get('/api/tasks', (req, res) => {
  res.json(store.getAll());
});

app.post('/api/tasks', (req, res) => {
  try {
    const task = store.create(req.body);
    res.status(201).json(task);
  } catch (error) {
    sendError(res, error);
  }
});

app.patch('/api/tasks/:id', (req, res) => {
  try {
    const task = store.update(req.params.id, req.body);
    res.json(task);
  } catch (error) {
    sendError(res, error);
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  try {
    store.remove(req.params.id);
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
  const message = status >= 500 ? '서버 오류가 발생했습니다.' : error.message;
  res.status(status).json({ message });
}

const server = app.listen(PORT, () => {
  console.log(`업무일지 서버 실행 중: http://localhost:${PORT}`);
  if (store.wasSeeded()) {
    console.log('data/tasks.json 파일을 초기 업무 데이터로 만들었습니다.');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`포트 ${PORT}이 이미 사용 중입니다. PORT 환경 변수를 바꿔 다시 실행해 주세요.`);
    process.exit(1);
  }
  throw error;
});
