import { getApiBaseUrl } from '../api/config';

export interface RevenueData {
  entryDate: string;
  cashAmount: number;
  terminalAmount: number;
  xolisAmount?: number;
}

export async function saveRevenueToApi(data: RevenueData) {
  const token = localStorage.getItem('microstore_token') || localStorage.getItem('token') || '';
  const baseUrl = getApiBaseUrl();
  const url = baseUrl.endsWith('/api') ? `${baseUrl}/v1/revenues` : `${baseUrl}/api/v1/revenues`;

  console.log(`Sending POST revenue request to: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      entryDate: data.entryDate,
      cashAmount: Number(data.cashAmount) || 0,
      terminalAmount: Number(data.terminalAmount) || 0,
      xolisAmount: Number(data.xolisAmount) || 0,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    console.error('Revenue API POST Error:', errData);
    throw new Error(errData.message || errData.error || 'Failed to save revenue');
  }

  const result = await response.json();
  console.log('REVENUE SAVED TO RENDER & SUPABASE DB:', result);
  return result;
}
