import { NextResponse } from 'next/server';
import { candlesToOhlcv, getHistoricalCandles, getHistoricalDailyCandles } from '@/lib/upstox';
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

function indiaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function GET() {
  const toDate = indiaDate();
  const dailyFromDate = yearsAgo(toDate, 10);
  const higherTimeframeFromDate = '2000-01-01';
  const results = [];

  for (const stock of UNIVERSE) {
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
      results.push({ ...stock, candleCount: daily.length, ok: true, scan });
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
