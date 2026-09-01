import { NextRequest, NextResponse } from 'next/server';
import { candlesToOhlcv, getHistoricalDailyCandles } from '@/lib/upstox';
import { scanGfs } from '@/lib/gfs-scan';

const DEFAULTS = {
  symbol: 'INFY',
  instrumentKey: 'NSE_EQ|INE009A01021',
  fromDate: '2024-01-01',
};

function validDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const symbol = params.get('symbol') || DEFAULTS.symbol;
    const instrumentKey = params.get('instrumentKey') || DEFAULTS.instrumentKey;
    const toDate = params.get('toDate') || new Date().toISOString().slice(0, 10);
    const fromDate = params.get('fromDate') || DEFAULTS.fromDate;

    if (!validDate(toDate) || !validDate(fromDate)) {
      return NextResponse.json({ ok: false, error: 'Dates must use YYYY-MM-DD format' }, { status: 400 });
    }

    const raw = await getHistoricalDailyCandles(instrumentKey, toDate, fromDate);
    const candles = candlesToOhlcv(raw);
    const scan = scanGfs(symbol, candles);

    return NextResponse.json({
      ok: true,
      symbol,
      instrumentKey,
      fromDate,
      toDate,
      candleCount: candles.length,
      scan,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scanner error';
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
