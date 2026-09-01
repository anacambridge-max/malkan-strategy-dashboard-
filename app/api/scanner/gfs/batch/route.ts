import { NextResponse } from 'next/server';
import {
  aggregateMonthly,
  aggregateWeekly,
  candlesToOhlcv,
} from '@/lib/indicators';
import {
  candlesToOhlcv as upstoxCandlesToOhlcv,
  getHistoricalCandles,
  getHistoricalDailyCandles,
  getNseFnoUniverse,
} from '@/lib/upstox';
import { GfsScan, scanGfs } from '@/lib/gfs-scan';

function yearsAgo(date: string, years: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function indiaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

type UniverseStock = Awaited<ReturnType<typeof getNseFnoUniverse>>[number];

type ScanResult = UniverseStock & {
  sector: string;
  candleCount: number;
  ok: boolean;
  scan?: GfsScan;
  error?: string;
};

function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : String(value);
}

async function scanOne(
  stock: UniverseStock,
  toDate: string,
  dailyFromDate: string,
  higherTimeframeFromDate: string,
): Promise<ScanResult> {
  try {
    // Fetch daily first. A full-universe scan can involve hundreds of symbols,
    // so we deliberately avoid firing 3 requests per symbol at once.
    const dailyRaw = await getHistoricalDailyCandles(
      stock.instrumentKey,
      toDate,
      dailyFromDate,
    );
    const daily = upstoxCandlesToOhlcv(dailyRaw);

    if (daily.length < 80) {
      return {
        ...stock,
        sector: 'NSE F&O',
        candleCount: daily.length,
        ok: false,
        error: `Only ${daily.length} daily candles available; minimum 80 required`,
      };
    }

    // Prefer Upstox native weekly/monthly candles because they keep RSI aligned
    // with the broker/chart timeframe. If either request is unavailable, fall
    // back to aggregation from the same daily series so one API failure cannot
    // wipe out the entire universe scan.
    const [weeklyResult, monthlyResult] = await Promise.allSettled([
      getHistoricalCandles(
        stock.instrumentKey,
        'weeks',
        1,
        toDate,
        higherTimeframeFromDate,
      ),
      getHistoricalCandles(
        stock.instrumentKey,
        'months',
        1,
        toDate,
        higherTimeframeFromDate,
      ),
    ]);

    const nativeWeekly = weeklyResult.status === 'fulfilled'
      ? upstoxCandlesToOhlcv(weeklyResult.value)
      : [];
    const nativeMonthly = monthlyResult.status === 'fulfilled'
      ? upstoxCandlesToOhlcv(monthlyResult.value)
      : [];

    const weekly = nativeWeekly.length >= 20 ? nativeWeekly : aggregateWeekly(daily);
    const monthly = nativeMonthly.length >= 20 ? nativeMonthly : aggregateMonthly(daily);
    const scan = scanGfs(stock.symbol, daily, weekly, monthly);

    const fallbackNotes: string[] = [];
    if (nativeWeekly.length < 20) {
      fallbackNotes.push(`weekly fallback (${weeklyResult.status === 'rejected' ? errorMessage(weeklyResult.reason) : `${nativeWeekly.length} candles`})`);
    }
    if (nativeMonthly.length < 20) {
      fallbackNotes.push(`monthly fallback (${monthlyResult.status === 'rejected' ? errorMessage(monthlyResult.reason) : `${nativeMonthly.length} candles`})`);
    }

    return {
      ...stock,
      sector: 'NSE F&O',
      candleCount: daily.length,
      ok: Boolean(scan),
      scan: scan ?? undefined,
      error: scan
        ? (fallbackNotes.length ? fallbackNotes.join('; ') : undefined)
        : 'Unable to calculate GFS from available daily/weekly/monthly candles',
    };
  } catch (error) {
    return {
      ...stock,
      sector: 'NSE F&O',
      candleCount: 0,
      ok: false,
      scan: undefined,
      error: errorMessage(error),
    };
  }
}

export async function GET() {
  const toDate = indiaDate();
  const dailyFromDate = yearsAgo(toDate, 10);
  const higherTimeframeFromDate = '2000-01-01';

  try {
    const universe = await getNseFnoUniverse();
    const results: ScanResult[] = [];

    // Full-universe scan. Keep concurrency deliberately low because each symbol
    // needs one daily request plus weekly/monthly requests and Upstox can rate
    // limit a burst of hundreds of historical-data calls.
    const batchSize = 3;
    for (let i = 0; i < universe.length; i += batchSize) {
      const batch = universe.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((stock) => scanOne(stock, toDate, dailyFromDate, higherTimeframeFromDate)),
      );
      results.push(...batchResults);
    }

    return NextResponse.json({
      ok: results.some((item) => item.ok),
      universe: 'NSE F&O equities',
      scanned: results.length,
      successful: results.filter((item) => item.ok).length,
      ready: results.filter((item) => item.scan?.ready).length,
      generatedAt: new Date().toISOString(),
      results,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: errorMessage(error),
      results: [],
    }, { status: 500 });
  }
}
