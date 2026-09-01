/**
 * Dynamic Express Backend API Base URL Configuration
 *
 * Frontend strictly targets Express backend endpoints (/api/auth/register, /api/auth/login)
 * or VITE_API_URL. Never targets Supabase URL (https://*.supabase.co) directly.
 */
export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && String(envUrl).trim() !== '') {
    const cleanUrl = String(envUrl).trim().replace(/\/+$/, '');
    // Ensure frontend NEVER routes requests directly to Supabase API URL
    if (!cleanUrl.includes('supabase.co')) {
      return cleanUrl;
    }
  }
  return '/api';
};

export const hasLiveApiBackend = (): boolean => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  return Boolean(
    envUrl &&
    String(envUrl).trim() !== '' &&
    !String(envUrl).includes('supabase.co') &&
    (String(envUrl).startsWith('http://') || String(envUrl).startsWith('https://'))
  );
};
