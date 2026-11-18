const { admin } = require('./supabase');
const {
  todayYMD,
  isValidYMD,
  addDays,
  formatKoreanDate,
  formatKoreanMonthDay,
  formatKoreanTime,
  seoulYMDFromISO,
  relativeDayLabel,
  startOfWeek,
  duePresentation,
} = require('./dates');

const PRIORITIES = ['High', 'Medium', 'Low'];
const STATUSES = ['todo', 'in-progress', 'done'];
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };
const STATUS_RANK = { 'in-progress': 0, todo: 1, done: 2 };

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function throwSupabase(error) {
  if (!error) return;
  if (error.code === '22P02') {
    throw httpError(404, '업무를 찾을 수 없습니다.');
  }
  if (error.code === '23514' || error.code === '23502') {
    throw httpError(400, '입력한 값이 올바르지 않습니다.');
  }
  if (error.code === '42703') {
    throw httpError(503, '업무 소유자 컬럼이 없습니다. Supabase SQL 편집기에서 supabase/auth.sql 을 실행해 주세요.');
  }
  throw httpError(503, '데이터베이스에 연결하지 못했습니다.');
}

function toTask(row) {
  const task = {
    id: row.id,
    title: row.title,
    description: row.description || '',
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
  };
  if (row.completed_at) task.completedAt = row.completed_at;
  return task;
}

function readTitle(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw httpError(400, '제목을 입력해 주세요.');
  }
  const title = value.trim();
  if (title.length > 120) {
    throw httpError(400, '제목은 120자 이내로 입력해 주세요.');
  }
  return title;
}

function readDescription(value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw httpError(400, '상세 내용은 문자열이어야 합니다.');
  }
  const description = value.trim();
  if (description.length > 2000) {
    throw httpError(400, '상세 내용은 2000자 이내로 입력해 주세요.');
  }
  return description;
}

function readDueDate(value) {
  if (!isValidYMD(value)) {
    throw httpError(400, '마감일은 YYYY-MM-DD 형식이어야 합니다.');
  }
  return value;
}

function readPriority(value) {
  if (!PRIORITIES.includes(value)) {
    throw httpError(400, '우선순위는 High, Medium, Low 중 하나여야 합니다.');
  }
  return value;
}

function readStatus(value) {
  if (!STATUSES.includes(value)) {
    throw httpError(400, '상태는 todo, in-progress, done 중 하나여야 합니다.');
  }
  return value;
}

function assertBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, '요청 본문이 올바르지 않습니다.');
  }
}

function timeValue(iso) {
  const value = Date.parse(iso || '');
  return Number.isNaN(value) ? 0 : value;
}

function comparePriority(a, b) {
  return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
}

function presentTask(task, today) {
  const view = { ...task };
  const presentation = duePresentation(task.dueDate, task.status, today);
  view.dueText = presentation.text;
  view.dueTone = presentation.tone;
  view.dueDateLabel = presentation.dateLabel;
  view.completedTimeLabel = formatKoreanTime(task.completedAt);
  return view;
}

function requireUser(user) {
  if (!user || !user.id) throw httpError(401, '로그인이 필요합니다.');
  return user;
}

async function fetchTasks(user) {
  requireUser(user);
  const { data, error } = await admin
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  throwSupabase(error);
  return (data || []).map(toTask);
}

async function getById(user, id) {
  requireUser(user);
  const { data, error } = await admin.from('tasks').select('*').eq('id', id).eq('user_id', user.id).maybeSingle();
  throwSupabase(error);
  if (!data) throw httpError(404, '업무를 찾을 수 없습니다.');
  return toTask(data);
}

async function ping() {
  const { error } = await admin.from('tasks').select('id').limit(1);
  throwSupabase(error);
}

async function getAll(user) {
  return fetchTasks(user);
}

async function create(user, body) {
  requireUser(user);
  assertBody(body);
  const row = {
    user_id: user.id,
    title: readTitle(body.title),
    description: readDescription(body.description),
    due_date: readDueDate(body.dueDate),
    priority: readPriority(body.priority),
    status: 'todo',
  };
  const { data, error } = await admin.from('tasks').insert(row).select('*').single();
  throwSupabase(error);
  return toTask(data);
}

async function update(user, id, body) {
  requireUser(user);
  assertBody(body);
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(body, 'title')) patch.title = readTitle(body.title);
  if (Object.prototype.hasOwnProperty.call(body, 'description')) patch.description = readDescription(body.description);
  if (Object.prototype.hasOwnProperty.call(body, 'dueDate')) patch.due_date = readDueDate(body.dueDate);
  if (Object.prototype.hasOwnProperty.call(body, 'priority')) patch.priority = readPriority(body.priority);
  if (Object.prototype.hasOwnProperty.call(body, 'status')) patch.status = readStatus(body.status);

  if (Object.keys(patch).length === 0) return getById(user, id);

  const { data, error } = await admin
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .maybeSingle();
  throwSupabase(error);
  if (!data) throw httpError(404, '업무를 찾을 수 없습니다.');
  return toTask(data);
}

async function remove(user, id) {
  requireUser(user);
  const { data, error } = await admin.from('tasks').delete().eq('id', id).eq('user_id', user.id).select('id');
  throwSupabase(error);
  if (!data || data.length === 0) throw httpError(404, '업무를 찾을 수 없습니다.');
}

async function getDashboard(user, now = new Date()) {
  const tasks = await fetchTasks(user);
  const today = todayYMD(now);
  const upcomingTo = addDays(today, 3);
  const weekStart = startOfWeek(today);

  const overdue = [];
  const todayTasks = [];
  const upcoming = [];
  const later = [];
  const done = [];

  for (const task of tasks) {
    const view = presentTask(task, today);
    if (task.status === 'done') {
      done.push(view);
      continue;
    }

    if (!isValidYMD(task.dueDate)) {
      later.push(view);
    } else if (task.dueDate < today) {
      overdue.push(view);
    } else if (task.dueDate === today) {
      todayTasks.push(view);
    } else if (task.dueDate <= upcomingTo) {
      upcoming.push(view);
    } else {
      later.push(view);
    }
  }

  const byCreated = (a, b) => timeValue(a.createdAt) - timeValue(b.createdAt);
  overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || comparePriority(a, b) || byCreated(a, b));
  todayTasks.sort(
    (a, b) =>
      comparePriority(a, b) ||
      (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) ||
      byCreated(a, b)
  );
  upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || comparePriority(a, b) || byCreated(a, b));
  later.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || comparePriority(a, b));

  const historyMap = new Map();
  let doneThisWeek = 0;

  for (const task of done) {
    const date = seoulYMDFromISO(task.completedAt);
    const key = date || 'unknown';
    if (!historyMap.has(key)) historyMap.set(key, []);
    historyMap.get(key).push(task);
    if (date && date >= weekStart && date <= today) doneThisWeek += 1;
  }

  const history = [...historyMap.entries()]
    .sort((a, b) => {
      if (a[0] === 'unknown') return 1;
      if (b[0] === 'unknown') return -1;
      return b[0].localeCompare(a[0]);
    })
    .map(([date, groupTasks]) => {
      groupTasks.sort((a, b) => timeValue(b.completedAt) - timeValue(a.completedAt));
      if (date === 'unknown') {
        return { date: null, relativeLabel: '', dateLabel: '완료일 없음', tasks: groupTasks };
      }
      return {
        date,
        relativeLabel: relativeDayLabel(date, today),
        dateLabel: formatKoreanDate(date),
        tasks: groupTasks,
      };
    });

  return {
    today,
    todayLabel: formatKoreanDate(today),
    upcomingLabel: `${formatKoreanMonthDay(addDays(today, 1))} – ${formatKoreanMonthDay(upcomingTo)}`,
    overdue,
    todayTasks,
    upcoming,
    later,
    history,
    stats: {
      overdue: overdue.length,
      today: todayTasks.length,
      upcoming: upcoming.length,
      doneThisWeek,
    },
  };
}

module.exports = {
  ping,
  getAll,
  create,
  update,
  remove,
  getDashboard,
};
