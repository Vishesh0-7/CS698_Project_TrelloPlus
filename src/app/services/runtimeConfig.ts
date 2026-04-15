const normalizeBaseUrl = (value: string | undefined, fallback: string): string => {
  const raw = value?.trim();
  if (!raw) {
    return fallback;
  }

  return raw.replace(/\/+$/, '');
};

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  'http://localhost:8080/api/v1',
);

export const WS_ENDPOINT = normalizeBaseUrl(
  import.meta.env.VITE_WS_ENDPOINT,
  'http://localhost:8080/api/v1/ws/board',
);