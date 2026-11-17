const state = {
  dashboard: null,
  view: 'board',
  editingId: null,
  priority: 'Medium',
  saving: false,
  onConfirm: null,
};

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
  const response = await fetch(url, { ...options, headers });
  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || '요청을 처리하지 못했습니다.');
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
      <div class="flex flex-wrap items-center gap-1.5">
        ${priorityBadge(task.priority)}
        ${statusBadge(task)}
      </div>
      <h3 class="mt-2 break-words text-sm font-semibold leading-6 text-slate-900">${escapeHtml(task.title)}</h3>
      ${description}
      <div class="mt-3 flex flex-wrap items-center gap-2">
        ${dueBadge(task)}
        ${dateLabel}
      </div>
      ${boardActions(task)}
    </article>
  `;
}

function renderColumn({ column, kicker, kickerClass, title, subtitle, tasks, emptyText, countClass }) {
  const body = tasks.length
    ? tasks.map(renderBoardCard).join('')
    : `<div class="rounded-xl border border-dashed border-slate-300/80 bg-white/50 px-4 py-10 text-center text-sm text-slate-400">${emptyText}</div>`;
  const countTone = tasks.length ? countClass : 'bg-slate-100 text-slate-500';

  return `
    <section data-column="${column}">
      <header class="mb-3 flex items-start justify-between gap-3 px-1">
        <div>
          <p class="text-[11px] font-semibold tracking-[0.16em] ${kickerClass}">${kicker}</p>
          <h2 class="mt-1 text-[15px] font-semibold text-slate-900">${title}</h2>
          <p class="mt-0.5 text-xs text-slate-400">${escapeHtml(subtitle)}</p>
        </div>
        <span class="mt-1 inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${countTone}">${tasks.length}</span>
      </header>
      <div class="space-y-3">${body}</div>
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
  if (!data.later.length) return '';
  return `
    <section class="mt-12" data-column="later">
      <header class="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <p class="text-[11px] font-semibold tracking-[0.16em] text-slate-400">LATER</p>
          <h2 class="mt-1 text-[15px] font-semibold text-slate-900">이후 일정</h2>
          <p class="mt-0.5 text-xs text-slate-400">4일 후부터 마감인 업무</p>
        </div>
        <span class="text-xs font-semibold text-slate-500">${data.later.length}건</span>
      </header>
      <div class="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${data.later.map(renderBoardCard).join('')}
      </div>
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
        tasks: data.overdue,
        emptyText: '밀린 업무가 없습니다',
        countClass: 'bg-rose-50 text-rose-700',
      })}
      ${renderColumn({
        column: 'today',
        kicker: 'TODAY',
        kickerClass: 'text-amber-600',
        title: '오늘',
        subtitle: '오늘 마감인 업무',
        tasks: data.todayTasks,
        emptyText: '오늘 마감인 업무가 없습니다',
        countClass: 'bg-amber-50 text-amber-800',
      })}
      ${renderColumn({
        column: 'upcoming',
        kicker: 'UPCOMING',
        kickerClass: 'text-emerald-600',
        title: '앞으로 3일',
        subtitle: data.upcomingLabel,
        tasks: data.upcoming,
        emptyText: '3일 안에 마감인 업무가 없습니다',
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
          <div class="flex flex-wrap items-center gap-1.5">${priorityBadge(task.priority)}</div>
          <h3 class="mt-2 break-words text-sm font-semibold leading-6 text-slate-900">${escapeHtml(task.title)}</h3>
          ${description}
          <p class="mt-2 text-xs text-slate-400">${meta}</p>
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

function renderHistory() {
  const groups = state.dashboard.history;
  const total = groups.reduce((sum, group) => sum + group.tasks.length, 0);

  if (!total) {
    document.getElementById('view-history').innerHTML = `
      <div class="mx-auto max-w-3xl rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center">
        <p class="text-base font-semibold text-slate-900">완료 기록이 없습니다</p>
        <p class="mt-2 text-sm text-slate-500">보드에서 업무를 완료하면 날짜별로 이곳에 쌓입니다.</p>
      </div>
    `;
    return;
  }

  const sections = groups
    .map((group) => {
      const heading = group.relativeLabel || group.dateLabel;
      const sub = group.relativeLabel ? `<p class="text-sm text-slate-400">${escapeHtml(group.dateLabel)}</p>` : '';
      return `
        <section class="mb-8" data-history-date="${escapeHtml(group.date || '')}">
          <div class="mb-3 flex items-baseline gap-3">
            <h3 class="text-base font-semibold text-slate-900">${escapeHtml(heading)}</h3>
            ${sub}
            <p class="ml-auto text-xs text-slate-400">${group.tasks.length}건</p>
          </div>
          <div class="space-y-3">${group.tasks.map(renderHistoryCard).join('')}</div>
        </section>
      `;
    })
    .join('');

  document.getElementById('view-history').innerHTML = `
    <div class="mx-auto max-w-3xl">
      <header class="mb-6">
        <p class="text-[11px] font-semibold tracking-[0.16em] text-slate-400">HISTORY</p>
        <h2 class="mt-1 text-xl font-semibold tracking-tight">완료 기록</h2>
        <p class="mt-1 text-sm text-slate-500">끝낸 일을 완료일 기준으로 모아 둡니다. 총 ${total}건.</p>
      </header>
      ${sections}
    </div>
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
  document.getElementById('view-board').classList.toggle('hidden', state.view !== 'board');
  document.getElementById('view-history').classList.toggle('hidden', state.view !== 'history');
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
    if (!state.dashboard) showLoadError();
    else toast(errorMessage(error));
    return false;
  }
}

function toast(message) {
  const element = document.getElementById('toast');
  element.textContent = message;
  element.classList.remove('translate-y-2', 'opacity-0');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    element.classList.add('translate-y-2', 'opacity-0');
  }, 2400);
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
  if (document.getElementById('confirm').classList.contains('hidden')) {
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
  if (document.getElementById('modal').classList.contains('hidden')) {
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
    if (nextView) state.view = nextView;
    const ok = await refresh();
    if (ok) toast(message);
  } catch (error) {
    toast(errorMessage(error));
  }
}

function requestDelete(task) {
  openConfirm({
    title: '업무를 삭제할까요?',
    body: `「${task.title}」 업무를 삭제합니다. 삭제한 뒤에는 되돌릴 수 없습니다.`,
    onConfirm: async () => {
      await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
      closeModal();
      const ok = await refresh();
      if (ok) toast('업무를 삭제했습니다.');
    },
  });
}

function onClick(event) {
  const tab = event.target.closest('[data-view-tab]');
  if (tab) {
    state.view = tab.dataset.viewTab;
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

  const task = id ? findTask(id) : null;
  if (id && !task) {
    toast('업무를 찾지 못했습니다. 화면을 다시 불러옵니다.');
    refresh();
    return;
  }

  if (action === 'edit') openModal(task);
  if (action === 'delete') requestDelete(task);
  if (action === 'start') updateStatus(id, 'in-progress', '진행 중으로 바꿨습니다.');
  if (action === 'complete') updateStatus(id, 'done', '완료 기록으로 옮겼습니다.');
  if (action === 'reopen') updateStatus(id, 'todo', '할 일로 되돌렸습니다.', 'board');
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
    if (!document.getElementById('modal').classList.contains('hidden')) closeModal();
  });

  setPriority('Medium');
  refresh();
}

init();
