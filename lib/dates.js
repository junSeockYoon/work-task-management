const TIME_ZONE = 'Asia/Seoul';

function formatYMD(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    numberingSystem: 'latn',
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  return `${map.year}-${map.month}-${map.day}`;
}

function todayYMD(now = new Date()) {
  return formatYMD(now);
}

function isValidYMD(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function addDays(ymd, days) {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function diffDays(fromYmd, toYmd) {
  const [fromYear, fromMonth, fromDay] = fromYmd.split('-').map(Number);
  const [toYear, toMonth, toDay] = toYmd.split('-').map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((to - from) / 86400000);
}

function weekdayOf(ymd) {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'UTC',
    weekday: 'long',
    numberingSystem: 'latn',
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === 'weekday');
  return weekday ? weekday.value : '';
}

function formatKoreanMonthDay(ymd) {
  const [, month, day] = ymd.split('-').map(Number);
  return `${month}월 ${day}일`;
}

function formatKoreanDate(ymd) {
  const weekday = weekdayOf(ymd);
  return weekday ? `${formatKoreanMonthDay(ymd)} ${weekday}` : formatKoreanMonthDay(ymd);
}

function formatKoreanTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    numberingSystem: 'latn',
  }).format(date);
}

function seoulYMDFromISO(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatYMD(date);
}

function relativeDayLabel(dateYmd, today) {
  const daysAgo = diffDays(dateYmd, today);
  if (daysAgo === 0) return '오늘';
  if (daysAgo === 1) return '어제';
  if (daysAgo === 2) return '그제';
  if (daysAgo > 2) return `${daysAgo}일 전`;
  return '';
}

function startOfWeek(ymd) {
  const [year, month, day] = ymd.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const mondayOffset = (weekday + 6) % 7;
  return addDays(ymd, -mondayOffset);
}

function duePresentation(dueDate, status, today) {
  if (!isValidYMD(dueDate)) {
    return { text: '날짜 없음', tone: 'neutral', dateLabel: '' };
  }

  const delta = diffDays(today, dueDate);
  const dateLabel = formatKoreanMonthDay(dueDate);

  if (status === 'done') {
    return { text: dateLabel, tone: 'neutral', dateLabel };
  }
  if (delta < 0) {
    return { text: `${Math.abs(delta)}일 지남`, tone: 'overdue', dateLabel };
  }
  if (delta === 0) {
    return { text: '오늘 마감', tone: 'today', dateLabel };
  }
  if (delta === 1) {
    return { text: '내일 마감', tone: 'soon', dateLabel };
  }
  if (delta <= 3) {
    return { text: `${delta}일 남음`, tone: 'soon', dateLabel };
  }
  return { text: `${delta}일 남음`, tone: 'later', dateLabel };
}

module.exports = {
  TIME_ZONE,
  formatYMD,
  todayYMD,
  isValidYMD,
  addDays,
  diffDays,
  formatKoreanMonthDay,
  formatKoreanDate,
  formatKoreanTime,
  seoulYMDFromISO,
  relativeDayLabel,
  startOfWeek,
  duePresentation,
};
