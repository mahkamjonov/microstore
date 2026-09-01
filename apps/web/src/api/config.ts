/**
 * Dynamic API Base URL Configuration
 */
export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '';

export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && String(envUrl).trim() !== '') {
    return String(envUrl).trim().replace(/\/+$/, '');
  }
  return '';
};

export const hasLiveApiBackend = (): boolean => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  return Boolean(
    envUrl &&
    String(envUrl).trim() !== '' &&
    (String(envUrl).startsWith('http://') || String(envUrl).startsWith('https://'))
  );
};
