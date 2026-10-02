import { apiFetch } from '../api/client';

export interface RevenueData {
  entryDate: string;
  cashAmount: number;
  terminalAmount: number;
  xolisAmount?: number;
}

export function saveRevenueToApi(data: RevenueData, options: { storeId?: string; txId?: string } = {}) {
  return apiFetch<{ success: boolean; data: any }>('/api/v1/revenues', {
    method: 'POST',
    storeId: options.storeId,
    headers: options.txId ? { 'X-Client-Tx-Id': options.txId } : undefined,
    body: {
      entryDate: data.entryDate,
      cashAmount: Number(data.cashAmount) || 0,
      terminalAmount: Number(data.terminalAmount) || 0,
      xolisAmount: Number(data.xolisAmount) || 0,
    },
  });
}
