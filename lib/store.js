const fs = require('fs');
const path = require('path');
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

// 저장소 접근은 이 파일만 담당합니다.
// DB로 교체할 때는 getAll, create, update, remove, getDashboard 시그니처를 유지하면
// 라우트와 화면은 그대로 둘 수 있습니다.
const FILE = path.join(__dirname, '..', 'data', 'tasks.json');
const PRIORITIES = ['High', 'Medium', 'Low'];
const STATUSES = ['todo', 'in-progress', 'done'];
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };
const STATUS_RANK = { 'in-progress': 0, todo: 1, done: 2 };

let tasks = [];
let seeded = false;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stamp(today, offset, hour, minute) {
  const ymd = addDays(today, offset);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${ymd}T${hh}:${mm}:00+09:00`;
}

function buildSeed(today) {
  const day = (offset) => addDays(today, offset);

  return [
    {
      id: 'task-001',
      title: '주간 보고서 초안 제출',
      description: '지난주 진행률, 위험 요소, 다음 주 계획을 한 장으로 정리해 팀 채널에 올립니다.',
      dueDate: day(-3),
      priority: 'High',
      status: 'todo',
      createdAt: stamp(today, -6, 9, 10),
    },
    {
      id: 'task-002',
      title: '고객사 견적 회신',
      description: '수정된 범위를 반영한 견적서를 확인하고 회신 메일을 보냅니다.',
      dueDate: day(-2),
      priority: 'High',
      status: 'in-progress',
      createdAt: stamp(today, -4, 11, 0),
    },
    {
      id: 'task-003',
      title: '디자인 시안 피드백 정리',
      description: '리뷰 코멘트를 화면별로 묶어 디자인 채널에 전달합니다.',
      dueDate: day(-1),
      priority: 'Medium',
      status: 'todo',
      createdAt: stamp(today, -3, 15, 20),
    },
    {
      id: 'task-004',
      title: '결제 오류 로그 확인',
      description: '오늘 아침 접수된 결제 실패 건의 원인과 영향 범위를 파악합니다.',
      dueDate: day(0),
      priority: 'High',
      status: 'in-progress',
      createdAt: stamp(today, -1, 18, 40),
    },
    {
      id: 'task-005',
      title: '스탠드업 메모 공유',
      description: '어제 한 일, 오늘 할 일, 막힌 점을 짧게 정리해 팀에 남깁니다.',
      dueDate: day(0),
      priority: 'Medium',
      status: 'todo',
      createdAt: stamp(today, 0, 8, 50),
    },
    {
      id: 'task-006',
      title: '경비 영수증 정리',
      description: '이번 주 법인카드 영수증을 항목별로 모아 둡니다.',
      dueDate: day(0),
      priority: 'Low',
      status: 'todo',
      createdAt: stamp(today, -1, 13, 15),
    },
    {
      id: 'task-007',
      title: '분기 목표 중간 점검',
      description: '목표 대비 진행률을 확인하고 조정할 항목을 표시합니다.',
      dueDate: day(1),
      priority: 'High',
      status: 'todo',
      createdAt: stamp(today, -2, 10, 0),
    },
    {
      id: 'task-008',
      title: '온보딩 문서 보완',
      description: '새 동료가 막혔던 환경 설정 단계를 문서에 추가합니다.',
      dueDate: day(2),
      priority: 'Medium',
      status: 'todo',
      createdAt: stamp(today, -1, 16, 5),
    },
    {
      id: 'task-009',
      title: '배포 체크리스트 작성',
      description: '점검 항목, 담당, 롤백 기준을 한 목록으로 만듭니다.',
      dueDate: day(3),
      priority: 'Low',
      status: 'todo',
      createdAt: stamp(today, 0, 9, 30),
    },
    {
      id: 'task-010',
      title: '팀 위키 목차 정리',
      description: '오래된 문서를 묶고 새 목차 초안을 잡습니다.',
      dueDate: day(6),
      priority: 'Low',
      status: 'todo',
      createdAt: stamp(today, -2, 14, 10),
    },
    {
      id: 'task-011',
      title: '연말 회고 질문 초안',
      description: '회고 때 쓸 질문 목록을 미리 적어 둡니다.',
      dueDate: day(12),
      priority: 'Medium',
      status: 'todo',
      createdAt: stamp(today, -1, 17, 45),
    },
    {
      id: 'task-012',
      title: '메일 백로그 정리',
      description: '답장이 필요한 메일만 남기고 참고용 메일은 보관했습니다.',
      dueDate: day(-1),
      priority: 'High',
      status: 'done',
      createdAt: stamp(today, -2, 9, 0),
      completedAt: stamp(today, -1, 11, 20),
    },
    {
      id: 'task-013',
      title: '회의록 공유',
      description: '결정 사항과 액션 아이템을 정리해 참석자에게 보냈습니다.',
      dueDate: day(-1),
      priority: 'Medium',
      status: 'done',
      createdAt: stamp(today, -1, 14, 0),
      completedAt: stamp(today, -1, 17, 5),
    },
    {
      id: 'task-014',
      title: '버그 재현 절차 기록',
      description: '재현 단계와 기대 결과를 이슈에 남겨 두었습니다.',
      dueDate: day(-2),
      priority: 'Medium',
      status: 'done',
      createdAt: stamp(today, -3, 10, 30),
      completedAt: stamp(today, -2, 15, 10),
    },
    {
      id: 'task-015',
      title: '테스트 계정 권한 정리',
      description: '쓰지 않는 테스트 계정 권한을 회수했습니다.',
      dueDate: day(-2),
      priority: 'Low',
      status: 'done',
      createdAt: stamp(today, -4, 11, 40),
      completedAt: stamp(today, -2, 18, 40),
    },
    {
      id: 'task-016',
      title: '협업 툴 알림 정리',
      description: '필요한 채널 알림만 켜 두도록 설정을 바꿨습니다.',
      dueDate: day(-4),
      priority: 'Low',
      status: 'done',
      createdAt: stamp(today, -5, 9, 20),
      completedAt: stamp(today, -4, 13, 0),
    },
    {
      id: 'task-017',
      title: '신규 기능 요구사항 정리',
      description: '요청 배경, 범위, 제외 항목을 구분해 문서로 남겼습니다.',
      dueDate: day(-5),
      priority: 'High',
      status: 'done',
      createdAt: stamp(today, -7, 15, 0),
      completedAt: stamp(today, -5, 19, 10),
    },
  ];
}

function persist(next) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  tasks = next;
}

function loadFromDisk() {
  if (!fs.existsSync(FILE)) {
    const seed = buildSeed(todayYMD());
    seeded = true;
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
    return seed;
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (error) {
    throw new Error('data/tasks.json 을 읽지 못했습니다. JSON 형식을 확인해 주세요.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('data/tasks.json 은 업무 배열이어야 합니다.');
  }

  return parsed;
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

function createId(list) {
  const max = list.reduce((highest, task) => {
    const match = /^task-(\d+)$/.exec(task.id || '');
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `task-${String(max + 1).padStart(3, '0')}`;
}

function timeValue(iso) {
  const value = Date.parse(iso || '');
  return Number.isNaN(value) ? 0 : value;
}

function comparePriority(a, b) {
  return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
}

function presentTask(task, today) {
  const view = clone(task);
  const presentation = duePresentation(task.dueDate, task.status, today);
  view.dueText = presentation.text;
  view.dueTone = presentation.tone;
  view.dueDateLabel = presentation.dateLabel;
  view.completedTimeLabel = formatKoreanTime(task.completedAt);
  return view;
}

function getAll() {
  return clone(tasks);
}

function create(body) {
  assertBody(body);
  const task = {
    id: createId(tasks),
    title: readTitle(body.title),
    description: readDescription(body.description),
    dueDate: readDueDate(body.dueDate),
    priority: readPriority(body.priority),
    status: 'todo',
    createdAt: new Date().toISOString(),
  };
  persist([...tasks, task]);
  return clone(task);
}

function update(id, body) {
  assertBody(body);
  const index = tasks.findIndex((task) => task.id === id);
  if (index < 0) {
    throw httpError(404, '업무를 찾을 수 없습니다.');
  }

  const next = clone(tasks);
  const task = next[index];

  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    task.title = readTitle(body.title);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    task.description = readDescription(body.description);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'dueDate')) {
    task.dueDate = readDueDate(body.dueDate);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'priority')) {
    task.priority = readPriority(body.priority);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    const status = readStatus(body.status);
    const wasDone = task.status === 'done';
    task.status = status;
    if (status === 'done' && !wasDone) {
      task.completedAt = new Date().toISOString();
    } else if (status !== 'done') {
      delete task.completedAt;
    }
  }

  persist(next);
  return clone(task);
}

function remove(id) {
  const next = tasks.filter((task) => task.id !== id);
  if (next.length === tasks.length) {
    throw httpError(404, '업무를 찾을 수 없습니다.');
  }
  persist(next);
}

function getDashboard(now = new Date()) {
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

    // 완료되지 않은 업무만 마감일로 나눕니다. 완료 업무는 마감일이 지나도 지연에 넣지 않습니다.
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
        return {
          date: null,
          relativeLabel: '',
          dateLabel: '완료일 없음',
          tasks: groupTasks,
        };
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

function wasSeeded() {
  return seeded;
}

tasks = loadFromDisk();

module.exports = {
  getAll,
  create,
  update,
  remove,
  getDashboard,
  wasSeeded,
};
