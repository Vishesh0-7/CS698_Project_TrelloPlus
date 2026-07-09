const normalizeBaseUrl = (value: string | undefined, fallback: string): string => {
  const raw = value?.trim();
  if (!raw) {
    return fallback;
  }

  return raw.replace(/\/+$/, '');
};

const env = process.env;

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return !['0', 'false', 'no', 'off'].includes(normalized);
};

export const API_BASE_URL = normalizeBaseUrl(
  env.VITE_API_BASE_URL,
  'http://localhost:8080/api/v1',
);

export const WS_ENDPOINT = normalizeBaseUrl(
  env.VITE_WS_ENDPOINT,
  'http://localhost:8080/api/v1/ws/board',
);

export const ENABLE_REALTIME = parseBooleanEnv(env.VITE_ENABLE_REALTIME, true);