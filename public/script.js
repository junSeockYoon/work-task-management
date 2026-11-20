const state = {
  dashboard: null,
  view: 'board',
  editingId: null,
  priority: 'Medium',
  saving: false,
  onConfirm: null,
  query: '',
  historyFrom: '',
  historyTo: '',
  formChecks: [],
  expandedColumns: {},
  laterOpen: false,
  historyOlderOpen: false,
  expandedHistoryDates: {},
};

const COLUMN_PREVIEW = 5;
const HISTORY_RECENT_DAYS = 7;

const PRIORITY_META = {
  High: { label: '높음', className: 'bg-rose-50 text-rose-700 ring-rose-600/10' },
  Medium: { label: '보통', className: 'bg-amber-50 text-amber-800 ring-amber-600/10' },
  Low: { label: '낮음', className: 'bg-slate-100 text-slate-600 ring-slate-500/10' },
};

const DUE_TONE = {
  overdue: 'bg-rose-50 text-rose-700 ring-rose-600/10',
  today: 'bg-amber-50 text-amber-800 ring-amber-600/10',
  soon: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  later: 'bg-slate-100 text-slate-600 ring-slate-500/10',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/10',
};

const PRIORITY_BUTTON = {
  idle: 'rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50',
  High: 'rounded-xl border border-rose-200 bg-rose-50 px-2 py-2 text-sm font-medium text-rose-700 ring-2 ring-rose-100',
  Medium: 'rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-sm font-medium text-amber-800 ring-2 ring-amber-100',
  Low: 'rounded-xl border border-slate-300 bg-slate-100 px-2 py-2 text-sm font-medium text-slate-700 ring-2 ring-slate-200',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function errorMessage(error) {
  if (error instanceof TypeError) return '서버에 연결하지 못했습니다.';
  return error.message || '요청을 처리하지 못했습니다.';
}

async function api(url, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(url, { ...options, headers, credentials: 'include' });
  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || '요청을 처리하지 못했습니다.');
    error.status = response.status;
    error.code = data.code;
    error.email = data.email;
    if (response.status === 401 && !url.startsWith('/api/auth')) showAuth();
    throw error;
  }
  return data;
}

function findTask(id) {
  const data = state.dashboard;
  if (!data) return null;
  const pools = [
    data.overdue,
    data.todayTasks,
    data.upcoming,
    data.later,
    ...data.history.map((group) => group.tasks),
  ];
  for (const pool of pools) {
    const found = pool.find((task) => task.id === id);
    if (found) return found;
  }
  return null;
}

function iconWrap(className, path) {
  return `<span class="flex h-8 w-8 items-center justify-center rounded-lg ${className}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4" aria-hidden="true">${path}</svg></span>`;
}

function renderStats(data) {
  const cards = [
    {
      label: '지연된 업무',
      value: data.stats.overdue,
      hint: '지난 일정',
      valueClass: data.stats.overdue > 0 ? 'text-rose-600' : 'text-slate-900',
      icon: iconWrap(
        'bg-rose-50 text-rose-600',
        '<circle cx="12" cy="12" r="8"></circle><path stroke-linecap="round" d="M12 8v4l2.5 2"></path>'
      ),
    },
    {
      label: '오늘 마감',
      value: data.stats.today,
      hint: '오늘 안에 마무리',
      valueClass: 'text-slate-900',
      icon: iconWrap(
        'bg-amber-50 text-amber-600',
        '<circle cx="12" cy="12" r="4"></circle><path stroke-linecap="round" d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"></path>'
      ),
    },
    {
      label: '3일 내 마감',
      value: data.stats.upcoming,
      hint: data.upcomingLabel,
      valueClass: 'text-slate-900',
      icon: iconWrap(
        'bg-emerald-50 text-emerald-600',
        '<rect x="4" y="5" width="16" height="15" rx="2"></rect><path stroke-linecap="round" d="M8 3v4M16 3v4M4 10h16"></path>'
      ),
    },
    {
      label: '이번 주 완료',
      value: data.stats.doneThisWeek,
      hint: '월요일부터 오늘까지',
      valueClass: 'text-slate-900',
      icon: iconWrap(
        'bg-sky-50 text-sky-600',
        '<path stroke-linecap="round" stroke-linejoin="round" d="M5 12.5 9.2 16.7 19 7"></path>'
      ),
    },
  ];

  document.getElementById('stats').innerHTML = cards
    .map(
      (card) => `
        <article class="rounded-xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm text-slate-500">${escapeHtml(card.label)}</p>
            ${card.icon}
          </div>
          <p class="mt-3 text-3xl font-semibold tracking-tight ${card.valueClass}">${card.value}</p>
          <p class="mt-1 text-xs text-slate-400">${escapeHtml(card.hint)}</p>
        </article>
      `
    )
    .join('');
}

function badge(text, className) {
  return `<span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}">${escapeHtml(text)}</span>`;
}

function priorityBadge(priority) {
  const meta = PRIORITY_META[priority] || {
    label: priority || '우선순위',
    className: 'bg-slate-100 text-slate-600 ring-slate-500/10',
  };
  return badge(meta.label, meta.className);
}

function dueBadge(task) {
  const tone = DUE_TONE[task.dueTone] || DUE_TONE.neutral;
  return badge(task.dueText || task.dueDate || '날짜 없음', tone);
}

function statusBadge(task) {
  if (task.status !== 'in-progress') return '';
  return badge('진행 중', 'bg-sky-50 text-sky-700 ring-sky-600/10');
}

function boardActions(task) {
  const start =
    task.status === 'todo'
      ? `<button type="button" data-action="start" data-id="${escapeHtml(task.id)}" class="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50">시작</button>`
      : '';

  return `
    <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
      <button type="button" data-action="edit" data-id="${escapeHtml(task.id)}" class="text-xs font-medium text-slate-500 hover:text-slate-800">수정</button>
      <button type="button" data-action="delete" data-id="${escapeHtml(task.id)}" class="text-xs font-medium text-slate-400 hover:text-rose-600">삭제</button>
      <div class="ml-auto flex items-center gap-2">
        ${start}
        <button type="button" data-action="complete" data-id="${escapeHtml(task.id)}" class="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800">완료</button>
      </div>
    </div>
  `;
}

function renderBoardCard(task) {
  const description = task.description
    ? `<p class="mt-2 line-clamp-3 whitespace-pre-line break-words text-sm leading-6 text-slate-500">${escapeHtml(task.description)}</p>`
    : '';
  const dateLabel = task.dueDateLabel
    ? `<span class="text-xs text-slate-400">${escapeHtml(task.dueDateLabel)}</span>`
    : '';

  return `
    <article class="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <button type="button" data-action="open" data-id="${escapeHtml(task.id)}" class="block w-full rounded-lg text-left">
        <div class="flex flex-wrap items-center gap-1.5">
          ${priorityBadge(task.priority)}
          ${statusBadge(task)}
        </div>
        <h3 class="mt-2 break-words text-sm font-semibold leading-6 text-slate-900">${escapeHtml(task.title)}</h3>
        ${description}
        <div class="mt-3 flex flex-wrap items-center gap-2">
          ${dueBadge(task)}
          ${dateLabel}
          ${taskFoot(task)}
          <span class="ml-auto text-xs font-medium text-slate-400">자세히</span>
        </div>
      </button>
      ${boardActions(task)}
    </article>
  `;
}

function diffDaysClient(fromYmd, toYmd) {
  const [fromYear, fromMonth, fromDay] = fromYmd.split('-').map(Number);
  const [toYear, toMonth, toDay] = toYmd.split('-').map(Number);
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86400000);
}

function isSearching() {
  return Boolean(state.query.trim());
}

function historyDateFilterActive() {
  return Boolean(state.historyFrom || state.historyTo);
}

function isHistoryFiltering() {
  return isSearching() || historyDateFilterActive();
}

function historyRange() {
  let from = state.historyFrom || '';
  let to = state.historyTo || '';
  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  return { from, to };
}

function groupInHistoryRange(group) {
  if (!historyDateFilterActive()) return true;
  if (!group.date) return false;
  const { from, to } = historyRange();
  if (from && group.date < from) return false;
  if (to && group.date > to) return false;
  return true;
}

function syncHistoryDateInputs() {
  const from = document.getElementById('history-from');
  const to = document.getElementById('history-to');
  if (!from || !to) return;
  if (from.value !== state.historyFrom) from.value = state.historyFrom;
  if (to.value !== state.historyTo) to.value = state.historyTo;
}

function renderColumn({ column, kicker, kickerClass, title, subtitle, tasks, emptyText, countClass }) {
  const expanded = Boolean(state.expandedColumns[column]) || isSearching();
  const hiddenCount = !expanded && tasks.length > COLUMN_PREVIEW ? tasks.length - COLUMN_PREVIEW : 0;
  const shown = hiddenCount ? tasks.slice(0, COLUMN_PREVIEW) : tasks;
  const body = tasks.length
    ? shown.map(renderBoardCard).join('')
    : `<div class="rounded-xl border border-dashed border-slate-300/80 bg-white/50 px-4 py-10 text-center text-sm text-slate-400">${emptyText}</div>`;
  const countTone = tasks.length ? countClass : 'bg-slate-100 text-slate-500';
  const more =
    hiddenCount > 0
      ? `<button type="button" data-action="expand-column" data-column="${column}" class="w-full rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-white">나머지 ${hiddenCount}건 더 보기</button>`
      : expanded && tasks.length > COLUMN_PREVIEW && !isSearching()
        ? `<button type="button" data-action="collapse-column" data-column="${column}" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50">접기</button>`
        : '';

  return `
    <section data-column="${column}">
      <header class="mb-3 flex items-start justify-between gap-3 px-1">
        <div>
          <p class="text-xs font-semibold tracking-widest ${kickerClass}">${kicker}</p>
          <h2 class="mt-1 text-base font-semibold text-slate-900">${title}</h2>
          <p class="mt-0.5 text-xs text-slate-400">${escapeHtml(subtitle)}</p>
        </div>
        <span class="mt-1 inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${countTone}">${tasks.length}</span>
      </header>
      <div class="space-y-3">${body}${more}</div>
    </section>
  `;
}

function renderFocusBanner(data) {
  if (data.stats.overdue > 0) {
    return banner(
      'bg-rose-50 text-rose-800 ring-rose-100',
      '지난 일정부터',
      `지연된 업무 ${data.stats.overdue}건을 먼저 처리해 주세요.`
    );
  }
  if (data.stats.today > 0) {
    return banner(
      'bg-amber-50 text-amber-900 ring-amber-100',
      '오늘 마감',
      `오늘 마감 ${data.stats.today}건부터 마무리해 주세요.`
    );
  }
  if (data.stats.upcoming > 0) {
    return banner(
      'bg-emerald-50 text-emerald-800 ring-emerald-100',
      '여유 있는 일정',
      '앞으로 3일 안의 업무를 미리 살펴봐 주세요.'
    );
  }
  return banner(
    'bg-white text-slate-600 ring-slate-200',
    '비어 있음',
    '새 업무를 추가하면 마감일에 맞춰 이곳에 정리됩니다.'
  );
}

function banner(className, kicker, message) {
  return `
    <div class="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${className}">
      <span class="font-semibold">${kicker}</span>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

function renderLater(data) {
  const tasks = visibleTasks(data.later);
  if (!tasks.length) return '';
  const open = state.laterOpen || isSearching();
  const expanded = Boolean(state.expandedColumns.later) || isSearching();
  const hiddenCount = open && !expanded && tasks.length > COLUMN_PREVIEW ? tasks.length - COLUMN_PREVIEW : 0;
  const shown = open ? (hiddenCount ? tasks.slice(0, COLUMN_PREVIEW) : tasks) : [];
  const more =
    hiddenCount > 0
      ? `<button type="button" data-action="expand-column" data-column="later" class="rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-white">나머지 ${hiddenCount}건 더 보기</button>`
      : open && expanded && tasks.length > COLUMN_PREVIEW && !isSearching()
        ? `<button type="button" data-action="collapse-column" data-column="later" class="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50">접기</button>`
        : '';

  return `
    <section class="mt-12" data-column="later">
      <button type="button" data-action="toggle-later" class="mb-3 flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-slate-50" aria-expanded="${open ? 'true' : 'false'}">
        <div>
          <p class="text-xs font-semibold tracking-widest text-slate-400">LATER</p>
          <h2 class="mt-1 text-base font-semibold text-slate-900">이후 일정 ${tasks.length}건</h2>
          <p class="mt-0.5 text-xs text-slate-400">${open ? '4일 후부터 마감인 업무' : '눌러서 펼치기 · 4일 후부터 마감'}</p>
        </div>
        <span class="text-sm font-medium text-slate-500">${open ? '접기' : '펼치기'}</span>
      </button>
      ${
        open
          ? `<div class="space-y-3">
              <div class="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">${shown.map(renderBoardCard).join('')}</div>
              ${more}
            </div>`
          : ''
      }
    </section>
  `;
}

function renderBoard() {
  const data = state.dashboard;
  document.getElementById('view-board').innerHTML = `
    ${renderFocusBanner(data)}
    <div class="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
      ${renderColumn({
        column: 'overdue',
        kicker: 'OVERDUE',
        kickerClass: 'text-rose-500',
        title: '지난 일정',
        subtitle: '마감일이 지난 업무',
        tasks: visibleTasks(data.overdue),
        emptyText: state.query.trim() ? '검색 결과가 없습니다' : '밀린 업무가 없습니다',
        countClass: 'bg-rose-50 text-rose-700',
      })}
      ${renderColumn({
        column: 'today',
        kicker: 'TODAY',
        kickerClass: 'text-amber-600',
        title: '오늘',
        subtitle: '오늘 마감인 업무',
        tasks: visibleTasks(data.todayTasks),
        emptyText: state.query.trim() ? '검색 결과가 없습니다' : '오늘 마감인 업무가 없습니다',
        countClass: 'bg-amber-50 text-amber-800',
      })}
      ${renderColumn({
        column: 'upcoming',
        kicker: 'UPCOMING',
        kickerClass: 'text-emerald-600',
        title: '앞으로 3일',
        subtitle: data.upcomingLabel,
        tasks: visibleTasks(data.upcoming),
        emptyText: state.query.trim() ? '검색 결과가 없습니다' : '3일 안에 마감인 업무가 없습니다',
        countClass: 'bg-emerald-50 text-emerald-700',
      })}
    </div>
    ${renderLater(data)}
  `;
}

function renderHistoryCard(task) {
  const description = task.description
    ? `<p class="mt-1.5 line-clamp-2 whitespace-pre-line break-words text-sm leading-6 text-slate-500">${escapeHtml(task.description)}</p>`
    : '';
  const doneLabel = task.completedTimeLabel ? `${escapeHtml(task.completedTimeLabel)} 완료` : '완료';
  const dueLabel = task.dueDateLabel ? `마감 ${escapeHtml(task.dueDateLabel)}` : '';
  const meta = dueLabel ? `${doneLabel} · ${dueLabel}` : doneLabel;

  return `
    <article class="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div class="flex items-start gap-3">
        <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 12.5 9.2 16.7 19 7" />
          </svg>
        </span>
        <div class="min-w-0 flex-1">
          <button type="button" data-action="open" data-id="${escapeHtml(task.id)}" class="block w-full rounded-lg text-left">
            <div class="flex flex-wrap items-center gap-1.5">${priorityBadge(task.priority)}</div>
            <h3 class="mt-2 break-words text-sm font-semibold leading-6 text-slate-900">${escapeHtml(task.title)}</h3>
            ${description}
            <p class="mt-2 text-xs text-slate-400">${meta}${taskFootText(task) ? ` · ${escapeHtml(taskFootText(task))}` : ''} · 자세히</p>
          </button>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" data-action="edit" data-id="${escapeHtml(task.id)}" class="text-xs font-medium text-slate-500 hover:text-slate-800">수정</button>
            <button type="button" data-action="delete" data-id="${escapeHtml(task.id)}" class="text-xs font-medium text-slate-400 hover:text-rose-600">삭제</button>
            <button type="button" data-action="reopen" data-id="${escapeHtml(task.id)}" class="ml-auto rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50">되돌리기</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function isRecentHistoryGroup(group, today) {
  if (!group.date) return false;
  const ago = diffDaysClient(group.date, today);
  return ago >= 0 && ago <= HISTORY_RECENT_DAYS;
}

function isHistoryGroupOpen(group, today) {
  const key = group.date || 'unknown';
  if (Object.prototype.hasOwnProperty.call(state.expandedHistoryDates, key)) {
    return Boolean(state.expandedHistoryDates[key]);
  }
  return group.date === today || isHistoryFiltering();
}

function renderHistoryGroup(group, today) {
  const key = group.date || 'unknown';
  const open = isHistoryGroupOpen(group, today);
  const heading = group.relativeLabel || group.dateLabel;
  const sub = group.relativeLabel ? escapeHtml(group.dateLabel) : '';
  return `
    <section class="mb-4" data-history-date="${escapeHtml(key)}">
      <button type="button" data-action="toggle-history" data-date="${escapeHtml(key)}" class="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-slate-50" aria-expanded="${open ? 'true' : 'false'}">
        <div class="min-w-0">
          <h3 class="text-base font-semibold text-slate-900">${escapeHtml(heading)}</h3>
          ${sub ? `<p class="mt-0.5 text-sm text-slate-400">${sub}</p>` : ''}
        </div>
        <p class="ml-auto shrink-0 text-xs text-slate-400">${group.tasks.length}건 · ${open ? '접기' : '펼치기'}</p>
      </button>
      ${open ? `<div class="mt-3 space-y-3">${group.tasks.map(renderHistoryCard).join('')}</div>` : ''}
    </section>
  `;
}

function renderHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  syncHistoryDateInputs();

  const today = state.dashboard.today;
  const filtering = isHistoryFiltering();
  const groups = state.dashboard.history
    .map((group) => ({ ...group, tasks: visibleTasks(group.tasks) }))
    .filter((group) => group.tasks.length)
    .filter(groupInHistoryRange);
  const total = groups.reduce((sum, group) => sum + group.tasks.length, 0);
  const { from, to } = historyRange();
  const rangeLabel =
    from && to ? `${from} ~ ${to}` : from ? `${from} 이후` : to ? `${to} 이전` : '';

  if (!total) {
    if (filtering) {
      list.innerHTML = `
        <div class="rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center">
          <p class="text-base font-semibold text-slate-900">검색 결과가 없습니다</p>
          <p class="mt-2 text-sm text-slate-500">${
            historyDateFilterActive()
              ? '기간이나 검색어를 바꿔 다시 찾아 보세요.'
              : '다른 단어로 제목, 내용, 체크 항목을 찾아 보세요.'
          }</p>
        </div>
      `;
      return;
    }
    list.innerHTML = `
      <div class="rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center">
        <p class="text-base font-semibold text-slate-900">완료 기록이 없습니다</p>
        <p class="mt-2 text-sm text-slate-500">보드에서 업무를 완료하면 날짜별로 이곳에 쌓입니다.</p>
      </div>
    `;
    return;
  }

  const recent = groups.filter((group) => isRecentHistoryGroup(group, today));
  const older = groups.filter((group) => !isRecentHistoryGroup(group, today));
  const showOlder = state.historyOlderOpen || filtering;
  const olderCount = older.reduce((sum, group) => sum + group.tasks.length, 0);
  const sections = (showOlder ? groups : recent).map((group) => renderHistoryGroup(group, today)).join('');
  const olderToggle =
    older.length && !filtering
      ? showOlder
        ? `<button type="button" data-action="hide-older-history" class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50">이전 기록 접기</button>`
        : `<button type="button" data-action="show-older-history" class="mt-2 w-full rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-white">이전 기록 ${olderCount}건 더 보기</button>`
      : '';
  const summary = filtering
    ? `${rangeLabel ? `기간 ${rangeLabel}` : '검색 결과'} · ${total}건`
    : `최근 ${HISTORY_RECENT_DAYS}일부터 먼저 보여 줍니다. 총 ${total}건.`;

  list.innerHTML = `
    <p class="mb-4 text-sm text-slate-500">${escapeHtml(summary)}</p>
    ${sections || `<div class="rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-sm text-slate-500">최근 ${HISTORY_RECENT_DAYS}일 기록이 없습니다.</div>`}
    ${olderToggle}
  `;
}

function paintTabs() {
  const base = 'rounded-lg px-3.5 py-1.5 text-sm font-medium transition';
  document.querySelectorAll('[data-view-tab]').forEach((button) => {
    const active = button.dataset.viewTab === state.view;
    button.className = `${base} ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`;
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function applyView() {
  const profile = state.view === 'profile';
  document.getElementById('view-board').classList.toggle('hidden', state.view !== 'board');
  document.getElementById('view-history').classList.toggle('hidden', state.view !== 'history');
  document.getElementById('view-profile').classList.toggle('hidden', !profile);
  document.getElementById('stats').classList.toggle('hidden', profile);
  document.getElementById('search-input').classList.toggle('hidden', profile);
  document.getElementById('add-button').classList.toggle('hidden', profile);
  if (profile) fillProfileForm(state.user);
  paintTabs();
}

function render() {
  if (!state.dashboard) return;
  document.getElementById('today-label').textContent = state.dashboard.todayLabel;
  renderStats(state.dashboard);
  renderBoard();
  renderHistory();
  applyView();
}

function showLoadError() {
  document.getElementById('stats').innerHTML = '';
  document.getElementById('view-history').classList.add('hidden');
  document.getElementById('view-board').classList.remove('hidden');
  document.getElementById('view-board').innerHTML = `
    <div class="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
      <p class="text-base font-semibold">화면을 불러오지 못했습니다</p>
      <p class="mt-2 text-sm text-slate-500">서버가 실행 중인지 확인한 뒤 다시 시도해 주세요.</p>
      <button type="button" data-action="retry" class="mt-5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">다시 시도</button>
    </div>
  `;
}

async function refresh() {
  try {
    const dashboard = await api('/api/dashboard');
    state.dashboard = dashboard;
    document.getElementById('add-button').disabled = false;
    render();
    return true;
  } catch (error) {
    if (error.status === 401) return false;
    if (!state.dashboard) showLoadError();
    else toast(errorMessage(error));
    return false;
  }
}

function toast(message, action) {
  const element = document.getElementById('toast');
  element.replaceChildren();
  const text = document.createElement('span');
  text.textContent = message;
  element.appendChild(text);
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.className = 'ml-3 font-semibold underline';
    button.addEventListener('click', () => {
      element.classList.add('translate-y-2', 'opacity-0', 'pointer-events-none');
      action.onClick();
    });
    element.appendChild(button);
    element.classList.remove('pointer-events-none');
  } else {
    element.classList.add('pointer-events-none');
  }
  element.classList.remove('translate-y-2', 'opacity-0');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    element.classList.add('translate-y-2', 'opacity-0', 'pointer-events-none');
  }, action ? 7000 : 2400);
}

function setPriority(priority) {
  state.priority = PRIORITY_META[priority] ? priority : 'Medium';
  document.querySelectorAll('#priority-picker [data-priority]').forEach((button) => {
    const selected = button.dataset.priority === state.priority;
    button.className = selected ? PRIORITY_BUTTON[button.dataset.priority] : PRIORITY_BUTTON.idle;
  });
}

function showFormError(message) {
  const element = document.getElementById('form-error');
  element.textContent = message;
  element.classList.remove('hidden');
}

function hideFormError() {
  const element = document.getElementById('form-error');
  element.textContent = '';
  element.classList.add('hidden');
}

function openModal(task) {
  state.editingId = task ? task.id : null;
  document.getElementById('modal-title').textContent = task ? '업무 수정' : '업무 추가';
  document.getElementById('submit-button').textContent = task ? '저장' : '추가';
  document.getElementById('delete-task').classList.toggle('hidden', !task);
  document.getElementById('title-input').value = task ? task.title : '';
  document.getElementById('description-input').value = task ? task.description || '' : '';
  document.getElementById('due-input').value = task ? task.dueDate || '' : state.dashboard?.today || '';
  document.getElementById('repeat-input').value = task && REPEAT_LABEL[task.repeat] ? task.repeat : 'none';
  document.getElementById('check-input').value = '';
  state.formChecks = (task && task.checks ? task.checks : []).map((item) => ({ ...item }));
  renderFormChecks();
  setPriority(task ? task.priority : 'Medium');
  hideFormError();

  const modal = document.getElementById('modal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overflow-hidden');
  document.getElementById('title-input').focus();
}

function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  state.editingId = null;
  if (
    document.getElementById('confirm').classList.contains('hidden') &&
    document.getElementById('detail').classList.contains('hidden') &&
    document.getElementById('password-modal').classList.contains('hidden')
  ) {
    document.body.classList.remove('overflow-hidden');
  }
}

const STATUS_LABEL = { todo: '할 일', 'in-progress': '진행 중', done: '완료' };
const REPEAT_LABEL = { daily: '매일', weekly: '매주', monthly: '매월' };

function visibleTasks(tasks) {
  const query = state.query.trim().toLowerCase();
  if (!query) return tasks;
  return tasks.filter((task) => {
    const text = [task.title, task.description, ...(task.checks || []).map((item) => item.label)].join('\n').toLowerCase();
    return text.includes(query);
  });
}

function taskFootText(task) {
  const bits = [];
  if (task.checks && task.checks.length) {
    const done = task.checks.filter((item) => item.done).length;
    bits.push(`체크 ${done}/${task.checks.length}`);
  }
  if (REPEAT_LABEL[task.repeat]) bits.push(REPEAT_LABEL[task.repeat]);
  return bits.join(' · ');
}

function taskFoot(task) {
  const text = taskFootText(task);
  if (!text) return '';
  return `<span class="text-xs text-slate-400">${escapeHtml(text)}</span>`;
}

function openDetail(task) {
  state.detailId = task.id;
  document.getElementById('detail-title').textContent = task.title;
  document.getElementById('detail-badges').innerHTML = [
    priorityBadge(task.priority),
    badge(STATUS_LABEL[task.status] || task.status, 'bg-slate-100 text-slate-600 ring-slate-500/10'),
    dueBadge(task),
  ].join('');
  const bits = [];
  if (task.dueDateLabel) bits.push(`마감 ${task.dueDateLabel}`);
  if (task.completedTimeLabel) bits.push(`${task.completedTimeLabel} 완료`);
  if (REPEAT_LABEL[task.repeat]) bits.push(REPEAT_LABEL[task.repeat]);
  document.getElementById('detail-meta').textContent = bits.join(' · ');
  const checks = document.getElementById('detail-checks');
  if (task.checks && task.checks.length) {
    checks.classList.remove('hidden');
    checks.innerHTML = task.checks
      .map(
        (item) => `
          <button type="button" data-action="toggle-check" data-id="${escapeHtml(task.id)}" data-check="${escapeHtml(item.id)}" class="flex w-full items-start gap-2 rounded-lg px-1 py-1.5 text-left text-sm hover:bg-slate-50 ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}">
            <span class="mt-0.5 h-4 w-4 shrink-0 rounded border ${item.done ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-white'}"></span>
            <span>${escapeHtml(item.label)}</span>
          </button>
        `
      )
      .join('');
  } else {
    checks.classList.add('hidden');
    checks.innerHTML = '';
  }
  const body = document.getElementById('detail-body');
  const empty = !task.description;
  body.textContent = empty ? '상세 내용이 없습니다.' : task.description;
  body.classList.toggle('text-slate-400', empty);
  body.classList.toggle('text-slate-700', !empty);

  const primary = document.getElementById('detail-primary');
  const done = task.status === 'done';
  primary.textContent = done ? '되돌리기' : '완료';
  primary.dataset.kind = done ? 'reopen' : 'complete';
  document.getElementById('detail-start').classList.toggle('hidden', task.status !== 'todo');

  const detail = document.getElementById('detail');
  detail.classList.remove('hidden');
  detail.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overflow-hidden');
  document.getElementById('detail-close').focus();
}

function closeDetail() {
  const detail = document.getElementById('detail');
  if (detail.classList.contains('hidden')) return;
  detail.classList.add('hidden');
  detail.setAttribute('aria-hidden', 'true');
  state.detailId = null;
  if (
    document.getElementById('modal').classList.contains('hidden') &&
    document.getElementById('confirm').classList.contains('hidden') &&
    document.getElementById('password-modal').classList.contains('hidden')
  ) {
    document.body.classList.remove('overflow-hidden');
  }
}

function openConfirm({ title, body, onConfirm }) {
  state.onConfirm = onConfirm;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').textContent = body;
  const confirm = document.getElementById('confirm');
  confirm.classList.remove('hidden');
  confirm.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overflow-hidden');
  document.getElementById('confirm-cancel').focus();
}

function closeConfirm() {
  const confirm = document.getElementById('confirm');
  confirm.classList.add('hidden');
  confirm.setAttribute('aria-hidden', 'true');
  state.onConfirm = null;
  if (
    document.getElementById('modal').classList.contains('hidden') &&
    document.getElementById('detail').classList.contains('hidden') &&
    document.getElementById('password-modal').classList.contains('hidden')
  ) {
    document.body.classList.remove('overflow-hidden');
  }
}

function validateForm() {
  const title = document.getElementById('title-input').value.trim();
  const description = document.getElementById('description-input').value.trim();
  const dueDate = document.getElementById('due-input').value;
  if (!title) return '제목을 입력해 주세요.';
  if (title.length > 120) return '제목은 120자 이내로 입력해 주세요.';
  if (!dueDate) return '마감일을 선택해 주세요.';
  if (description.length > 2000) return '상세 내용은 2000자 이내로 입력해 주세요.';
  if (!PRIORITY_META[state.priority]) return '우선순위를 선택해 주세요.';
  return '';
}

async function onSubmit(event) {
  event.preventDefault();
  if (state.saving) return;

  const message = validateForm();
  if (message) {
    showFormError(message);
    return;
  }

  hideFormError();
  const isEdit = Boolean(state.editingId);
  const id = state.editingId;
  const payload = {
    title: document.getElementById('title-input').value.trim(),
    description: document.getElementById('description-input').value.trim(),
    dueDate: document.getElementById('due-input').value,
    priority: state.priority,
    repeat: document.getElementById('repeat-input').value,
    checks: currentFormChecks(),
  };

  const submit = document.getElementById('submit-button');
  state.saving = true;
  submit.disabled = true;
  submit.textContent = '저장 중';

  try {
    if (isEdit) {
      await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
      state.view = 'board';
    }
    closeModal();
    const ok = await refresh();
    if (ok) toast(isEdit ? '수정했습니다.' : '업무를 추가했습니다.');
  } catch (error) {
    showFormError(errorMessage(error));
  } finally {
    state.saving = false;
    submit.disabled = false;
    submit.textContent = state.editingId ? '저장' : '추가';
  }
}

async function updateStatus(id, status, message, nextView) {
  try {
    await api(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    closeDetail();
    if (nextView) state.view = nextView;
    const ok = await refresh();
    if (ok) toast(message);
  } catch (error) {
    toast(errorMessage(error));
  }
}

function requestDelete(task) {
  closeDetail();
  openConfirm({
    title: '업무를 삭제할까요?',
    body: `「${task.title}」 업무를 삭제합니다. 삭제한 직후에는 되돌릴 수 있습니다.`,
    onConfirm: async () => {
      await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
      closeModal();
      const ok = await refresh();
      if (ok) {
        toast('업무를 삭제했습니다.', {
          label: '되돌리기',
          onClick: async () => {
            try {
              await api(`/api/tasks/${task.id}/restore`, { method: 'POST' });
              const restored = await refresh();
              if (restored) toast('삭제를 취소했습니다.');
            } catch (error) {
              toast(errorMessage(error));
            }
          },
        });
      }
    },
  });
}

function onClick(event) {
  const tab = event.target.closest('[data-view-tab]');
  if (tab) {
    state.view = tab.dataset.viewTab;
    if (state.view === 'profile') fillProfileForm(state.user);
    applyView();
    return;
  }

  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;

  if (action === 'retry') {
    refresh();
    return;
  }
  if (action === 'expand-column') {
    state.expandedColumns[button.dataset.column] = true;
    render();
    return;
  }
  if (action === 'collapse-column') {
    state.expandedColumns[button.dataset.column] = false;
    render();
    return;
  }
  if (action === 'toggle-later') {
    state.laterOpen = !state.laterOpen;
    render();
    return;
  }
  if (action === 'show-older-history') {
    state.historyOlderOpen = true;
    render();
    return;
  }
  if (action === 'hide-older-history') {
    state.historyOlderOpen = false;
    render();
    return;
  }
  if (action === 'toggle-history') {
    const key = button.dataset.date || 'unknown';
    const today = state.dashboard?.today;
    const current = Object.prototype.hasOwnProperty.call(state.expandedHistoryDates, key)
      ? Boolean(state.expandedHistoryDates[key])
      : key === today || isSearching();
    state.expandedHistoryDates[key] = !current;
    render();
    return;
  }

  const task = id ? findTask(id) : null;
  if (id && !task) {
    toast('업무를 찾지 못했습니다. 화면을 다시 불러옵니다.');
    refresh();
    return;
  }

  if (action === 'open') openDetail(task);
  if (action === 'toggle-check') toggleCheck(task, button.dataset.check);
  if (action === 'edit') openModal(task);
  if (action === 'delete') requestDelete(task);
  if (action === 'start') updateStatus(id, 'in-progress', '진행 중으로 바꿨습니다.');
  if (action === 'complete') updateStatus(id, 'done', doneMessage(task));
  if (action === 'reopen') updateStatus(id, 'todo', '할 일로 되돌렸습니다.', 'board');
}

const authMode = { value: 'login' };

const AUTH_FIELD_IDS = ['auth-username', 'auth-password', 'auth-password-confirm', 'auth-email', 'auth-phone'];

function showAuthError(message) {
  const element = document.getElementById('auth-error');
  element.textContent = message;
  element.classList.remove('hidden');
}

function hideAuthError() {
  const element = document.getElementById('auth-error');
  element.textContent = '';
  element.classList.add('hidden');
}

function clearAuthFieldErrors() {
  for (const id of AUTH_FIELD_IDS) {
    const field = document.getElementById(id);
    if (!field) continue;
    field.classList.remove('field-invalid');
    field.removeAttribute('aria-invalid');
  }
}

function markAuthFieldInvalid(id) {
  const field = document.getElementById(id);
  if (!field) return;
  field.classList.add('field-invalid');
  field.setAttribute('aria-invalid', 'true');
}

function validateAuthForm() {
  clearAuthFieldErrors();
  hideAuthError();

  const username = document.getElementById('auth-username').value.trim().toLowerCase();
  const password = document.getElementById('auth-password').value;
  const confirm = document.getElementById('auth-password-confirm').value;
  const email = document.getElementById('auth-email').value.trim();
  const phone = document.getElementById('auth-phone').value.trim();
  const signup = authMode.value === 'signup';
  const checks = [];

  if (!username) {
    checks.push({ id: 'auth-username', message: '아이디를 입력해 주세요.' });
  } else if (!/^[a-z0-9_]{4,20}$/.test(username)) {
    checks.push({
      id: 'auth-username',
      message: '아이디는 영문 소문자, 숫자, 밑줄(_)만 사용해 4~20자로 입력해 주세요.',
    });
  }

  if (!password) {
    checks.push({ id: 'auth-password', message: '비밀번호를 입력해 주세요.' });
  } else if (password.length < 8) {
    checks.push({ id: 'auth-password', message: '비밀번호는 8자 이상으로 입력해 주세요.' });
  } else if (password.length > 72) {
    checks.push({ id: 'auth-password', message: '비밀번호는 72자 이내로 입력해 주세요.' });
  }

  if (signup) {
    if (!confirm) {
      checks.push({ id: 'auth-password-confirm', message: '비밀번호 확인을 입력해 주세요.' });
    } else if (password !== confirm) {
      checks.push({ id: 'auth-password-confirm', message: '비밀번호가 서로 다릅니다.' });
    }

    if (!email) {
      checks.push({ id: 'auth-email', message: '이메일을 입력해 주세요.' });
    } else if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(email)) {
      checks.push({ id: 'auth-email', message: '이메일 형식이 올바르지 않습니다.' });
    }

    const digits = phone.replace(/\D/g, '');
    if (!phone) {
      checks.push({ id: 'auth-phone', message: '전화번호를 입력해 주세요.' });
    } else if (!/^01\d{8,9}$/.test(digits)) {
      checks.push({ id: 'auth-phone', message: '전화번호는 01로 시작하는 10~11자리 숫자로 입력해 주세요.' });
    }
  }

  if (!checks.length) return true;

  for (const item of checks) markAuthFieldInvalid(item.id);
  showAuthError(checks[0].message);
  document.getElementById(checks[0].id)?.focus();
  return false;
}

function hideAuthPending() {
  document.getElementById('auth-pending').classList.add('hidden');
  document.getElementById('auth-pending-lead').textContent = '';
}

function showAuthPending(email, message) {
  const pending = document.getElementById('auth-pending');
  const lead = document.getElementById('auth-pending-lead');
  lead.textContent =
    message ||
    `${email || '가입한 이메일'}로 인증 메일을 보냈습니다. 확인한 뒤 로그인해 주세요.`;
  pending.dataset.email = email || '';
  pending.classList.remove('hidden');
}

function setAuthMode(mode) {
  authMode.value = mode === 'signup' ? 'signup' : 'login';
  const signup = authMode.value === 'signup';
  document.getElementById('auth-title').textContent = signup ? '회원가입' : '로그인';
  document.getElementById('auth-lead').textContent = signup
    ? '가입 후 이메일 인증이 필요합니다.'
    : '아이디와 비밀번호로 들어옵니다.';
  document.getElementById('email-field').classList.toggle('hidden', !signup);
  document.getElementById('phone-field').classList.toggle('hidden', !signup);
  document.getElementById('password-confirm-field').classList.toggle('hidden', !signup);
  document.getElementById('auth-password').autocomplete = signup ? 'new-password' : 'current-password';
  document.getElementById('auth-submit').textContent = signup ? '가입하기' : '로그인';
  document.getElementById('auth-switch').textContent = signup ? '이미 계정이 있나요? 로그인' : '계정이 없나요? 회원가입';
  hideAuthError();
  clearAuthFieldErrors();
  if (!signup) hideAuthPending();
}

function showAuth() {
  state.user = null;
  state.dashboard = null;
  document.getElementById('boot-status').classList.add('hidden');
  document.getElementById('workspace').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('add-button').disabled = true;
  document.getElementById('account-button').classList.add('hidden');
  document.getElementById('logout-button').classList.add('hidden');
}

function showApp(user) {
  state.user = user;
  document.getElementById('boot-status').classList.add('hidden');
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('workspace').classList.remove('hidden');
  const account = document.getElementById('account-button');
  account.textContent = user.username || '마이페이지';
  account.classList.remove('hidden');
  document.getElementById('logout-button').classList.remove('hidden');
}

function fillProfileForm(user) {
  if (!user) return;
  document.getElementById('profile-username').value = user.username || '';
  document.getElementById('profile-email').value = user.email || '';
  document.getElementById('profile-phone').value = user.phone || '';
  const error = document.getElementById('profile-error');
  error.textContent = '';
  error.classList.add('hidden');
}

function showProfileError(message) {
  const error = document.getElementById('profile-error');
  error.textContent = message;
  error.classList.remove('hidden');
}

function showPasswordError(message) {
  const error = document.getElementById('password-error');
  error.textContent = message;
  error.classList.remove('hidden');
}

function hidePasswordError() {
  const error = document.getElementById('password-error');
  error.textContent = '';
  error.classList.add('hidden');
}

function openPasswordModal() {
  hidePasswordError();
  document.getElementById('password-current').value = '';
  document.getElementById('password-new').value = '';
  document.getElementById('password-confirm').value = '';
  const modal = document.getElementById('password-modal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overflow-hidden');
  document.getElementById('password-current').focus();
}

function closePasswordModal() {
  const modal = document.getElementById('password-modal');
  if (modal.classList.contains('hidden')) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  if (
    document.getElementById('modal').classList.contains('hidden') &&
    document.getElementById('detail').classList.contains('hidden') &&
    document.getElementById('confirm').classList.contains('hidden')
  ) {
    document.body.classList.remove('overflow-hidden');
  }
}

function goToBoard() {
  state.view = 'board';
  applyView();
}

async function onProfileSubmit(event) {
  event.preventDefault();
  const button = document.getElementById('profile-submit');
  const email = document.getElementById('profile-email').value.trim();
  const phone = document.getElementById('profile-phone').value.trim();

  button.disabled = true;
  button.textContent = '저장 중';
  try {
    const user = await api('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ email, phone }) });
    state.user = user;
    if (state.dashboard) state.dashboard.user = user;
    showApp(user);
    toast('회원 정보를 저장했습니다.');
    goToBoard();
  } catch (error) {
    showProfileError(errorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = '저장';
  }
}

async function onPasswordSubmit(event) {
  event.preventDefault();
  hidePasswordError();
  const button = document.getElementById('password-submit');
  const currentPassword = document.getElementById('password-current').value;
  const newPassword = document.getElementById('password-new').value;
  const newPasswordConfirm = document.getElementById('password-confirm').value;
  if (newPassword !== newPasswordConfirm) {
    showPasswordError('새 비밀번호가 서로 다릅니다.');
    return;
  }

  button.disabled = true;
  button.textContent = '변경 중';
  try {
    const user = await api('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({
        email: state.user?.email || document.getElementById('profile-email').value.trim(),
        phone: state.user?.phone || document.getElementById('profile-phone').value.trim(),
        currentPassword,
        newPassword,
        newPasswordConfirm,
      }),
    });
    state.user = user;
    if (state.dashboard) state.dashboard.user = user;
    showApp(user);
    closePasswordModal();
    toast('비밀번호를 바꿨습니다.');
    goToBoard();
  } catch (error) {
    showPasswordError(errorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = '변경';
  }
}

async function onAuthSubmit(event) {
  event.preventDefault();
  hideAuthPending();
  if (!validateAuthForm()) return;

  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const phone = document.getElementById('auth-phone').value.trim();
  const email = document.getElementById('auth-email').value.trim();

  const button = document.getElementById('auth-submit');
  const signup = authMode.value === 'signup';
  button.disabled = true;
  button.textContent = signup ? '가입 중' : '로그인 중';
  try {
    const result = await api(signup ? '/api/auth/signup' : '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(signup ? { username, password, phone, email } : { username, password }),
    });
    if (result.pendingConfirmation) {
      setAuthMode('login');
      showAuthPending(result.email, result.message);
      toast('인증 메일을 보냈습니다.');
      return;
    }
    showApp(result);
    const ok = await refresh();
    if (ok) toast(signup ? '가입했습니다.' : '로그인했습니다.');
  } catch (error) {
    if (error.code === 'email_not_confirmed') {
      setAuthMode('login');
      showAuthPending(error.email, error.message);
      return;
    }
    showAuthError(errorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = signup ? '가입하기' : '로그인';
  }
}

async function onResendConfirmation() {
  const pending = document.getElementById('auth-pending');
  const email = pending.dataset.email || document.getElementById('auth-email').value.trim();
  const username = document.getElementById('auth-username').value.trim();
  const button = document.getElementById('auth-resend');
  button.disabled = true;
  button.textContent = '보내는 중';
  try {
    const result = await api('/api/auth/resend-confirmation', {
      method: 'POST',
      body: JSON.stringify(email ? { email } : { username }),
    });
    showAuthPending(result.email, result.message);
    toast('인증 메일을 다시 보냈습니다.');
  } catch (error) {
    showAuthError(errorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = '인증 메일 다시 보내기';
  }
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    toast(errorMessage(error));
  }
  showAuth();
}

async function boot() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('confirmed') === '1') {
    history.replaceState({}, '', '/');
  }
  try {
    const dashboard = await api('/api/dashboard');
    state.dashboard = dashboard;
    showApp(dashboard.user || { username: '' });
    document.getElementById('add-button').disabled = false;
    render();
    if (params.get('confirmed') === '1') toast('이메일 인증이 완료되었습니다.');
  } catch (error) {
    showAuth();
    if (params.get('confirmed') === '1') {
      setAuthMode('login');
      showAuthError('인증은 끝났습니다. 아이디로 로그인해 주세요.');
      return;
    }
    if (error.status !== 401) showAuthError(errorMessage(error));
  }
}

function renderFormChecks() {
  const host = document.getElementById('check-list');
  host.innerHTML = state.formChecks
    .map(
      (item, index) => `
        <div class="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <span class="min-w-0 flex-1 truncate text-sm text-slate-700">${escapeHtml(item.label)}</span>
          <button type="button" data-check-remove="${index}" class="text-xs font-medium text-slate-400 hover:text-rose-600">빼기</button>
        </div>
      `
    )
    .join('');
}

function currentFormChecks() {
  const pending = document.getElementById('check-input').value.trim();
  const checks = state.formChecks.map((item) => ({ id: item.id, label: item.label, done: Boolean(item.done) }));
  if (pending) checks.push({ label: pending, done: false });
  return checks;
}

function addFormCheck() {
  const input = document.getElementById('check-input');
  const label = input.value.trim();
  if (!label) return;
  if (state.formChecks.length >= 30) {
    showFormError('체크 항목은 30개까지 넣을 수 있습니다.');
    return;
  }
  hideFormError();
  state.formChecks.push({ id: crypto.randomUUID(), label, done: false });
  input.value = '';
  renderFormChecks();
}

function doneMessage(task) {
  if (task && task.repeat && task.repeat !== 'none') return '완료했습니다. 다음 반복 일정을 만들었습니다.';
  return '완료 기록으로 옮겼습니다.';
}

async function toggleCheck(task, checkId) {
  const checks = (task.checks || []).map((item) => (item.id === checkId ? { ...item, done: !item.done } : item));
  try {
    await api(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ checks }),
    });
    const ok = await refresh();
    const next = findTask(task.id);
    if (ok && next && state.detailId === task.id) openDetail(next);
  } catch (error) {
    toast(errorMessage(error));
  }
}

function init() {
  document.getElementById('add-button').addEventListener('click', () => openModal());
  document.getElementById('task-form').addEventListener('submit', onSubmit);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('cancel-button').addEventListener('click', closeModal);
  document.getElementById('delete-task').addEventListener('click', () => {
    const task = findTask(state.editingId);
    if (task) requestDelete(task);
  });
  document.getElementById('priority-picker').addEventListener('click', (event) => {
    const button = event.target.closest('[data-priority]');
    if (!button) return;
    setPriority(button.dataset.priority);
  });
  document.getElementById('modal').addEventListener('click', (event) => {
    if (event.target.closest('[data-modal-panel]')) return;
    closeModal();
  });
  document.getElementById('confirm').addEventListener('click', (event) => {
    if (event.target.closest('[data-confirm-panel]')) return;
    closeConfirm();
  });
  document.getElementById('confirm-cancel').addEventListener('click', closeConfirm);
  document.getElementById('confirm-accept').addEventListener('click', async () => {
    if (!state.onConfirm) return;
    const accept = document.getElementById('confirm-accept');
    accept.disabled = true;
    accept.textContent = '삭제 중';
    try {
      await state.onConfirm();
      closeConfirm();
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      accept.disabled = false;
      accept.textContent = '삭제';
    }
  });
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!document.getElementById('confirm').classList.contains('hidden')) {
      closeConfirm();
      return;
    }
    if (!document.getElementById('password-modal').classList.contains('hidden')) {
      closePasswordModal();
      return;
    }
    if (!document.getElementById('detail').classList.contains('hidden')) {
      closeDetail();
      return;
    }
    if (!document.getElementById('modal').classList.contains('hidden')) closeModal();
  });

  document.getElementById('auth-form').addEventListener('submit', onAuthSubmit);
  for (const id of AUTH_FIELD_IDS) {
    const field = document.getElementById(id);
    if (!field) continue;
    field.addEventListener('input', () => {
      field.classList.remove('field-invalid');
      field.removeAttribute('aria-invalid');
    });
  }
  document.getElementById('auth-resend').addEventListener('click', onResendConfirmation);
  document.getElementById('auth-switch').addEventListener('click', () => {
    setAuthMode(authMode.value === 'signup' ? 'login' : 'signup');
  });
  document.getElementById('logout-button').addEventListener('click', logout);
  document.getElementById('account-button').addEventListener('click', () => {
    state.view = 'profile';
    applyView();
  });
  document.getElementById('profile-form').addEventListener('submit', onProfileSubmit);
  document.getElementById('password-open').addEventListener('click', openPasswordModal);
  document.getElementById('password-close').addEventListener('click', closePasswordModal);
  document.getElementById('password-cancel').addEventListener('click', closePasswordModal);
  document.getElementById('password-form').addEventListener('submit', onPasswordSubmit);
  document.getElementById('password-modal').addEventListener('click', (event) => {
    if (event.target.closest('[data-password-panel]')) return;
    closePasswordModal();
  });
  document.getElementById('detail-close').addEventListener('click', closeDetail);
  document.getElementById('detail').addEventListener('click', (event) => {
    if (event.target.closest('[data-detail-panel]')) return;
    closeDetail();
  });
  document.getElementById('detail-edit').addEventListener('click', () => {
    const task = findTask(state.detailId);
    closeDetail();
    if (task) openModal(task);
  });
  document.getElementById('detail-delete').addEventListener('click', () => {
    const task = findTask(state.detailId);
    if (task) requestDelete(task);
  });
  document.getElementById('detail-start').addEventListener('click', () => {
    const task = findTask(state.detailId);
    if (!task) return;
    updateStatus(task.id, 'in-progress', '진행 중으로 바꿨습니다.');
  });
  document.getElementById('detail-primary').addEventListener('click', () => {
    const task = findTask(state.detailId);
    if (!task) return;
    const kind = document.getElementById('detail-primary').dataset.kind;
    if (kind === 'reopen') updateStatus(task.id, 'todo', '할 일로 되돌렸습니다.', 'board');
    else updateStatus(task.id, 'done', doneMessage(task));
  });
  document.getElementById('search-input').addEventListener('input', (event) => {
    state.query = event.target.value;
    render();
  });
  document.getElementById('history-from').addEventListener('change', (event) => {
    state.historyFrom = event.target.value || '';
    if (state.view !== 'history') state.view = 'history';
    render();
  });
  document.getElementById('history-to').addEventListener('change', (event) => {
    state.historyTo = event.target.value || '';
    if (state.view !== 'history') state.view = 'history';
    render();
  });
  document.getElementById('history-clear-dates').addEventListener('click', () => {
    state.historyFrom = '';
    state.historyTo = '';
    render();
  });
  document.getElementById('check-add').addEventListener('click', addFormCheck);
  document.getElementById('check-input').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addFormCheck();
  });
  document.getElementById('check-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-check-remove]');
    if (!button) return;
    const index = Number(button.dataset.checkRemove);
    state.formChecks = state.formChecks.filter((_, itemIndex) => itemIndex !== index);
    renderFormChecks();
  });

  setPriority('Medium');
  boot();
}

init();
