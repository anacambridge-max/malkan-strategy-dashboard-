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

function yearsAgo(date: string, years: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const toDate = new Date().toISOString().slice(0, 10);
  // Upstox V3 daily candles allow a maximum retrieval window of 1 decade.
  // Use the full 10-year window so monthly/weekly RSI has enough Wilder-RSI
  // warm-up history without exceeding Upstox's date-range limit.
  const fromDate = yearsAgo(toDate, 10);
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
