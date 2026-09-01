import { NextRequest, NextResponse } from 'next/server';
import { candlesToOhlcv, getHistoricalDailyCandles } from '@/lib/upstox';

const DEFAULT_INFY_KEY = 'NSE_EQ|INE009A01021';

function validDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const instrumentKey = params.get('instrumentKey') || DEFAULT_INFY_KEY;
    const toDate = params.get('toDate') || new Date().toISOString().slice(0, 10);
    const fromDate = params.get('fromDate') || undefined;

    if (!validDate(toDate) || (fromDate && !validDate(fromDate))) {
      return NextResponse.json({ error: 'Dates must use YYYY-MM-DD format' }, { status: 400 });
    }

    const raw = await getHistoricalDailyCandles(instrumentKey, toDate, fromDate);
    const candles = candlesToOhlcv(raw);

    return NextResponse.json({
      ok: true,
      instrumentKey,
      count: candles.length,
      candles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown market-data error';
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
