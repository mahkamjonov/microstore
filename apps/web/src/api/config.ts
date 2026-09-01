/**
 * Dynamic Express Backend API Base URL Configuration (Render Live API)
 *
 * Frontend strictly targets the deployed Express API on Render (https://microstore.onrender.com)
 * using import.meta.env.VITE_API_URL as its base URL.
 */
export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://microstore.onrender.com';

export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && String(envUrl).trim() !== '') {
    const cleanUrl = String(envUrl).trim().replace(/\/+$/, '');
    if (!cleanUrl.includes('supabase.co')) {
      return cleanUrl;
    }
  }
  return 'https://microstore.onrender.com';
};

export const hasLiveApiBackend = (): boolean => {
  const envUrl = (import.meta as any).env?.VITE_API_URL || 'https://microstore.onrender.com';
  return Boolean(
    envUrl &&
    String(envUrl).trim() !== '' &&
    !String(envUrl).includes('supabase.co') &&
    (String(envUrl).startsWith('http://') || String(envUrl).startsWith('https://'))
  );
};
