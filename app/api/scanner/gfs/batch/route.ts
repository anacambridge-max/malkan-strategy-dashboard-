import { NextResponse } from 'next/server';
import { candlesToOhlcv, getHistoricalCandles, getHistoricalDailyCandles, getNseFnoUniverse } from '@/lib/upstox';
import { scanGfs } from '@/lib/gfs-scan';

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

async function scanOne(stock: UniverseStock, toDate: string, dailyFromDate: string, higherTimeframeFromDate: string) {
  try {
    const [dailyRaw, weeklyRaw, monthlyRaw] = await Promise.all([
      getHistoricalDailyCandles(stock.instrumentKey, toDate, dailyFromDate),
      getHistoricalCandles(stock.instrumentKey, 'weeks', 1, toDate, higherTimeframeFromDate),
      getHistoricalCandles(stock.instrumentKey, 'months', 1, toDate, higherTimeframeFromDate),
    ]);

    const daily = candlesToOhlcv(dailyRaw);
    const weekly = candlesToOhlcv(weeklyRaw);
    const monthly = candlesToOhlcv(monthlyRaw);
    const scan = scanGfs(stock.symbol, daily, weekly, monthly);

    return {
      ...stock,
      sector: 'NSE F&O',
      candleCount: daily.length,
      ok: Boolean(scan),
      scan: scan ?? undefined,
      error: scan ? undefined : 'Insufficient historical candles for GFS calculation',
    };
  } catch (error) {
    return {
      ...stock,
      sector: 'NSE F&O',
      candleCount: 0,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown scanner error',
    };
  }
}

export async function GET() {
  const toDate = indiaDate();
  const dailyFromDate = yearsAgo(toDate, 10);
  const higherTimeframeFromDate = '2000-01-01';

  try {
    const universe = await getNseFnoUniverse();
    const results: Awaited<ReturnType<typeof scanOne>>[] = [];

    // Keep concurrency bounded so a full-universe scan does not overwhelm the
    // market-data API. The scanner still evaluates every active F&O underlying.
    const batchSize = 6;
    for (let i = 0; i < universe.length; i += batchSize) {
      const batch = universe.slice(i, i + batchSize);
      results.push(...await Promise.all(batch.map((stock) => scanOne(stock, toDate, dailyFromDate, higherTimeframeFromDate))));
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
