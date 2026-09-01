import { NextResponse } from 'next/server';
import { aggregateMonthly, aggregateWeekly } from '@/lib/indicators';
import { candlesToOhlcv, getHistoricalDailyCandles, getNseFnoUniverse } from '@/lib/upstox';
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

async function scanOne(
  stock: UniverseStock,
  toDate: string,
  dailyFromDate: string,
): Promise<ScanResult> {
  try {
    // One daily request per stock. Weekly/monthly candles are reconstructed
    // from the same daily OHLCV series, which gives the correct timeframe
    // closes while avoiding 3x API traffic across the 200+ stock universe.
    const dailyRaw = await getHistoricalDailyCandles(
      stock.instrumentKey,
      toDate,
      dailyFromDate,
    );
    const daily = candlesToOhlcv(dailyRaw);

    if (daily.length < 80) {
      return {
        ...stock,
        sector: 'NSE F&O',
        candleCount: daily.length,
        ok: false,
        error: `Only ${daily.length} daily candles available; minimum 80 required`,
      };
    }

    const weekly = aggregateWeekly(daily);
    const monthly = aggregateMonthly(daily);
    const scan = scanGfs(stock.symbol, daily, weekly, monthly);

    return {
      ...stock,
      sector: 'NSE F&O',
      candleCount: daily.length,
      ok: Boolean(scan),
      scan: scan ?? undefined,
      error: scan ? undefined : 'Unable to calculate GFS from available timeframe candles',
    };
  } catch (error) {
    return {
      ...stock,
      sector: 'NSE F&O',
      candleCount: 0,
      ok: false,
      scan: undefined,
      error: error instanceof Error ? error.message : 'Unknown scanner error',
    };
  }
}

export async function GET() {
  const toDate = indiaDate();
  const dailyFromDate = yearsAgo(toDate, 10);

  try {
    const universe = await getNseFnoUniverse();
    const results: ScanResult[] = [];

    // Full live NSE F&O universe. Bounded concurrency keeps the historical-data
    // API stable while scanning every stock instead of only a demo shortlist.
    const batchSize = 6;
    for (let i = 0; i < universe.length; i += batchSize) {
      const batch = universe.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((stock) => scanOne(stock, toDate, dailyFromDate)),
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
      error: error instanceof Error ? error.message : 'Unable to build NSE F&O universe',
      results: [],
    }, { status: 500 });
  }
}
