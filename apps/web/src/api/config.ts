/**
 * Returns dynamic API base URL from VITE_API_URL environment variable or relative path
 */
export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && String(envUrl).trim() !== '') {
    return String(envUrl).trim().replace(/\/+$/, '');
  }
  return '';
};
