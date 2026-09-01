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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type UniverseStock = Awaited<ReturnType<typeof getNseFnoUniverse>>[number];

type ScanResult = UniverseStock & {
  sector: string;
  candleCount: number;
  ok: boolean;
  scan?: GfsScan;
  error?: string;
};

type ScanResponse = {
  ok: boolean;
  universe: string;
  scanned: number;
  successful: number;
  ready: number;
  generatedAt: string;
  results: ScanResult[];
};

async function scanOne(
  stock: UniverseStock,
  toDate: string,
  dailyFromDate: string,
): Promise<ScanResult> {
  try {
    // Use one daily request per stock and reconstruct weekly/monthly candles
    // locally. This preserves the RSI inputs while avoiding 3x API traffic.
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

async function runFullScan(): Promise<ScanResponse> {
  const toDate = indiaDate();
  const dailyFromDate = yearsAgo(toDate, 10);
  const universe = await getNseFnoUniverse();
  const results: ScanResult[] = [];

  // Keep only two historical requests in flight and add a small pause between
  // batches. Upstox documents 50 requests/sec and 500 requests/min for standard
  // APIs, but pacing avoids bursts and makes the scanner resilient to transient
  // 429 responses during a full-universe refresh.
  const batchSize = 2;
  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((stock) => scanOne(stock, toDate, dailyFromDate)),
    );
    results.push(...batchResults);
    if (i + batchSize < universe.length) await sleep(250);
  }

  return {
    ok: results.some((item) => item.ok),
    universe: 'NSE F&O equities',
    scanned: results.length,
    successful: results.filter((item) => item.ok).length,
    ready: results.filter((item) => item.scan?.ready).length,
    generatedAt: new Date().toISOString(),
    results,
  };
}

// Dashboard and GFS Scanner can mount at the same time. Without a shared
// in-flight promise they would each start another 210-stock scan and quickly
// trigger Upstox 429s. Reuse the same scan for 60 seconds.
let scanCache: { expiresAt: number; response: ScanResponse } | null = null;
let scanInFlight: Promise<ScanResponse> | null = null;

async function getCachedScan() {
  if (scanCache && scanCache.expiresAt > Date.now()) return scanCache.response;

  if (!scanInFlight) {
    scanInFlight = runFullScan()
      .then((response) => {
        scanCache = { expiresAt: Date.now() + 60_000, response };
        return response;
      })
      .finally(() => {
        scanInFlight = null;
      });
  }

  return scanInFlight;
}

export async function GET() {
  try {
    return NextResponse.json(await getCachedScan());
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to build NSE F&O universe',
      results: [],
    }, { status: 500 });
  }
}
