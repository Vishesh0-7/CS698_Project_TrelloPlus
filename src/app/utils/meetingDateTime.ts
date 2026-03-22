type DateLike =
  | string
  | Date
  | { year?: number; month?: number | string; monthValue?: number; day?: number; dayOfMonth?: number }
  | number[]
  | null
  | undefined;
type TimeLike =
  | string
  | { hour?: number; minute?: number; second?: number; nano?: number }
  | number[]
  | null
  | undefined;

const monthNameToNumber = (monthName: string): number | null => {
  const normalized = monthName.trim().toUpperCase();
  const months = [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER',
  ];
  const idx = months.indexOf(normalized);
  return idx >= 0 ? idx + 1 : null;
};

const toSafeString = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
};

const parseDateParts = (date?: DateLike): { year: number; month: number; day: number } | null => {
  if (!date) return null;

  if (Array.isArray(date)) {
    const year = Number(date[0]);
    const month = Number(date[1]);
    const day = Number(date[2]);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { year, month, day };
      }
    }
  }

  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return null;
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }

  if (typeof date === 'object') {
    const year = Number((date as { year?: number }).year);
    const rawMonth = (date as { month?: number | string; monthValue?: number }).month;
    const monthFromMonthValue = Number((date as { monthValue?: number }).monthValue);
    const month = typeof rawMonth === 'string'
      ? (monthNameToNumber(rawMonth) ?? Number.NaN)
      : Number(rawMonth ?? monthFromMonthValue);
    const day = Number((date as { day?: number; dayOfMonth?: number }).day ?? (date as { dayOfMonth?: number }).dayOfMonth);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { year, month, day };
      }
    }
  }

  const normalized = toSafeString(date);
  if (!normalized) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, month, day };
};

const parseTimeParts = (time?: TimeLike): { hour: number; minute: number; second: number } => {
  if (!time) {
    return { hour: 0, minute: 0, second: 0 };
  }

  if (Array.isArray(time)) {
    const hour = Number(time[0] ?? 0);
    const minute = Number(time[1] ?? 0);
    const second = Number(time[2] ?? 0);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59) {
      return { hour, minute, second };
    }
    return { hour: 0, minute: 0, second: 0 };
  }

  if (typeof time === 'object') {
    const hour = Number((time as { hour?: number }).hour ?? 0);
    const minute = Number((time as { minute?: number }).minute ?? 0);
    const second = Number((time as { second?: number }).second ?? 0);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59) {
      return { hour, minute, second };
    }
    return { hour: 0, minute: 0, second: 0 };
  }

  const normalized = toSafeString(time);
  if (!normalized) {
    return { hour: 0, minute: 0, second: 0 };
  }

  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(normalized);
  if (!match) {
    return { hour: 0, minute: 0, second: 0 };
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return { hour: 0, minute: 0, second: 0 };
  }

  return { hour, minute, second };
};

export const formatMeetingDate = (date?: DateLike, options?: Intl.DateTimeFormatOptions): string => {
  const parsedDate = parseDateParts(date);
  if (!parsedDate) return 'N/A';

  const localDate = new Date(parsedDate.year, parsedDate.month - 1, parsedDate.day);
  return localDate.toLocaleDateString('en-US', options ?? {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatMeetingTime = (time?: TimeLike, options?: Intl.DateTimeFormatOptions): string => {
  if (!time) return 'N/A';
  const { hour, minute, second } = parseTimeParts(time);

  const localDate = new Date(2000, 0, 1, hour, minute, second);
  return localDate.toLocaleTimeString('en-US', options ?? {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const getMeetingSortValue = (date?: DateLike, time?: TimeLike): number => {
  const parsedDate = parseDateParts(date);
  if (!parsedDate) return Number.NEGATIVE_INFINITY;

  const { hour, minute, second } = parseTimeParts(time);
  return Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day, hour, minute, second);
};
