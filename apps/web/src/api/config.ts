/**
 * Dynamic API Base URL Configuration
 */
export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && String(envUrl).trim() !== '') {
    return String(envUrl).trim().replace(/\/+$/, '');
  }
  return '';
};
