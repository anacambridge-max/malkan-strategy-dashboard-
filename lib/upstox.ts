export type UpstoxCandle = [string, number, number, number, number, number, number?];

const BASE_URL = 'https://api.upstox.com/v3';

function getToken() {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) throw new Error('UPSTOX_ACCESS_TOKEN is not configured');
  return token;
}

export type HistoricalUnit = 'days' | 'weeks' | 'months';

export async function getHistoricalCandles(
  instrumentKey: string,
  unit: HistoricalUnit,
  interval: 1,
  toDate: string,
  fromDate?: string,
): Promise<UpstoxCandle[]> {
  const encodedKey = encodeURIComponent(instrumentKey);
  const from = fromDate ? `/${fromDate}` : '';
  const url = `${BASE_URL}/historical-candle/${encodedKey}/${unit}/${interval}/${toDate}${from}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    cache: 'no-store',
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.errors?.[0]?.message || body?.message || `Upstox returned HTTP ${response.status}`;
    throw new Error(message);
  }
  if (body?.status !== 'success' || !Array.isArray(body?.data?.candles)) {
    throw new Error('Unexpected Upstox historical-candle response');
  }
  return body.data.candles as UpstoxCandle[];
}

export async function getHistoricalDailyCandles(
  instrumentKey: string,
  toDate: string,
  fromDate?: string,
): Promise<UpstoxCandle[]> {
  return getHistoricalCandles(instrumentKey, 'days', 1, toDate, fromDate);
}

export function candlesToOhlcv(candles: UpstoxCandle[]) {
  return candles.map(([timestamp, open, high, low, close, volume]) => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume,
  })).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
