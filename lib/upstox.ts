export type UpstoxCandle = [string, number, number, number, number, number, number?];

const BASE_URL = 'https://api.upstox.com/v3';
const NSE_INSTRUMENTS_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';

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

export type FnoUniverseStock = {
  symbol: string;
  company: string;
  instrumentKey: string;
};

type InstrumentRecord = {
  segment?: string;
  name?: string;
  instrument_type?: string;
  instrument_key?: string;
  trading_symbol?: string;
  short_name?: string;
  underlying_type?: string;
  underlying_symbol?: string;
  underlying_key?: string;
};

let fnoUniverseCache: { expiresAt: number; stocks: FnoUniverseStock[] } | null = null;

/**
 * Build the live NSE F&O equity universe from Upstox's daily BOD instrument file.
 * We collect equity underlyings that currently have an NSE_FO contract, then
 * map them back to their NSE_EQ instrument keys for historical equity candles.
 */
export async function getNseFnoUniverse(): Promise<FnoUniverseStock[]> {
  if (fnoUniverseCache && fnoUniverseCache.expiresAt > Date.now()) {
    return fnoUniverseCache.stocks;
  }

  const response = await fetch(NSE_INSTRUMENTS_URL, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Unable to load Upstox NSE instrument master (HTTP ${response.status})`);
  }

  const instruments = await response.json() as InstrumentRecord[];
  if (!Array.isArray(instruments)) {
    throw new Error('Unexpected Upstox NSE instrument-master response');
  }

  const equities = new Map<string, InstrumentRecord>();
  const fnoSymbols = new Set<string>();

  for (const instrument of instruments) {
    if (instrument.segment === 'NSE_EQ' && instrument.instrument_type === 'EQ' && instrument.instrument_key && instrument.trading_symbol) {
      equities.set(instrument.trading_symbol, instrument);
    }

    if (
      instrument.segment === 'NSE_FO' &&
      instrument.underlying_type === 'EQUITY' &&
      instrument.underlying_symbol &&
      (instrument.instrument_type === 'FUT' || instrument.instrument_type === 'CE' || instrument.instrument_type === 'PE')
    ) {
      fnoSymbols.add(instrument.underlying_symbol);
    }
  }

  const stocks = [...fnoSymbols]
    .map((symbol) => {
      const equity = equities.get(symbol);
      if (!equity?.instrument_key) return null;
      return {
        symbol,
        company: equity.short_name || equity.name || symbol,
        instrumentKey: equity.instrument_key,
      } satisfies FnoUniverseStock;
    })
    .filter((stock): stock is FnoUniverseStock => Boolean(stock))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  if (!stocks.length) throw new Error('No active NSE F&O equity underlyings found in Upstox instrument master');

  fnoUniverseCache = { expiresAt: Date.now() + 6 * 60 * 60 * 1000, stocks };
  return stocks;
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
