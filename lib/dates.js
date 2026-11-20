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

function isValidHM(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function normalizeHM(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function nowHM(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    numberingSystem: 'latn',
  }).formatToParts(now);

  const map = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  // Some environments return "24" for midnight; normalize to 00.
  const hour = map.hour === '24' ? '00' : map.hour;
  return `${hour}:${map.minute}`;
}

function formatDueTimeLabel(hm) {
  const value = normalizeHM(hm);
  if (!value) return '';
  const [hour, minute] = value.split(':').map(Number);
  const period = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 || 12;
  return `${period} ${hour12}:${String(minute).padStart(2, '0')}`;
}

function addMonths(ymd, months) {
  const [year, month, day] = ymd.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const result = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay)));
  const nextYear = result.getUTCFullYear();
  const nextMonth = String(result.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(result.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function nextRepeatDue(due, repeat, today) {
  const base = due >= today ? due : today;
  if (repeat === 'daily') return addDays(base, 1);
  if (repeat === 'weekly') return addDays(base, 7);
  if (repeat === 'monthly') return addMonths(base, 1);
  return base;
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

function duePresentation(dueDate, status, today, dueTime) {
  if (!isValidYMD(dueDate)) {
    return { text: '날짜 없음', tone: 'neutral', dateLabel: '' };
  }

  const delta = diffDays(today, dueDate);
  const timeLabel = formatDueTimeLabel(dueTime);
  const dateLabel = timeLabel
    ? `${formatKoreanMonthDay(dueDate)} ${timeLabel}`
    : formatKoreanMonthDay(dueDate);
  const hm = normalizeHM(dueTime);

  if (status === 'done') {
    return { text: dateLabel, tone: 'neutral', dateLabel };
  }
  if (delta < 0) {
    return { text: `${Math.abs(delta)}일 지남`, tone: 'overdue', dateLabel };
  }
  if (delta === 0) {
    if (hm && hm < nowHM()) {
      return { text: '시각 지남', tone: 'overdue', dateLabel };
    }
    return { text: timeLabel ? `오늘 ${timeLabel}` : '오늘 마감', tone: 'today', dateLabel };
  }
  if (delta === 1) {
    return { text: timeLabel ? `내일 ${timeLabel}` : '내일 마감', tone: 'soon', dateLabel };
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
  isValidHM,
  normalizeHM,
  nowHM,
  formatDueTimeLabel,
  addDays,
  addMonths,
  nextRepeatDue,
  diffDays,
  formatKoreanMonthDay,
  formatKoreanDate,
  formatKoreanTime,
  seoulYMDFromISO,
  relativeDayLabel,
  startOfWeek,
  duePresentation,
};
