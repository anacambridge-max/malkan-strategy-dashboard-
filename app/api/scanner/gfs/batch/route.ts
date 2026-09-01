import { NextResponse } from 'next/server';
import { candlesToOhlcv, getHistoricalDailyCandles } from '@/lib/upstox';
import { scanGfs } from '@/lib/gfs-scan';

const UNIVERSE = [
  { symbol: 'INFY', company: 'Infosys', sector: 'IT', instrumentKey: 'NSE_EQ|INE009A01021' },
  { symbol: 'RELIANCE', company: 'Reliance Industries', sector: 'Energy', instrumentKey: 'NSE_EQ|INE002A01018' },
  { symbol: 'TCS', company: 'Tata Consultancy Services', sector: 'IT', instrumentKey: 'NSE_EQ|INE467B01029' },
  { symbol: 'HDFCBANK', company: 'HDFC Bank', sector: 'Banking', instrumentKey: 'NSE_EQ|INE040A01034' },
  { symbol: 'SBIN', company: 'State Bank of India', sector: 'Banking', instrumentKey: 'NSE_EQ|INE062A01020' },
] as const;

export async function GET() {
  const toDate = new Date().toISOString().slice(0, 10);
  // RSI needs a long warm-up, especially on monthly bars. Starting in 2024
  // leaves only ~32 monthly observations and can materially distort RSI.
  // Keep several years of daily history so the weekly/monthly Wilder RSI
  // converges to the value shown by charting platforms.
  const fromDate = '2010-01-01';
  const results = [];

  for (const stock of UNIVERSE) {
    try {
      const raw = await getHistoricalDailyCandles(stock.instrumentKey, toDate, fromDate);
      const candles = candlesToOhlcv(raw);
      const scan = scanGfs(stock.symbol, candles);
      results.push({ ...stock, candleCount: candles.length, ok: true, scan });
    } catch (error) {
      results.push({
        ...stock,
        candleCount: 0,
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown scanner error',
      });
    }
  }

  return NextResponse.json({
    ok: results.some((item) => item.ok),
    scanned: results.length,
    successful: results.filter((item) => item.ok).length,
    generatedAt: new Date().toISOString(),
    results,
  });
}
