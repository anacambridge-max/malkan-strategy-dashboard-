export type GfsInput = {
  monthlyRsi: number;
  weeklyRsi: number;
  dailyRsi: number;
  dailyRsiPrevious: number;
  setupLow: number;
  entry: number;
  target: number;
  relativeVolume: number;
  cip: boolean;
  confirmation: boolean;
  smallCandle: boolean;
  secondTest: boolean;
};

export type GfsResult = {
  monthlyTrend: boolean;
  weeklyTrend: boolean;
  dailyZone: boolean;
  dailyTurningUp: boolean;
  volumeConfirmed: boolean;
  riskRewardConfirmed: boolean;
  gfsReady: boolean;
  setupType: string;
  score: number;
  riskReward: number;
};

/**
 * GFS (Grandfather-Father-Son) rule engine.
 *
 * Core long setup:
 * - Monthly RSI > 60
 * - Weekly RSI > 60
 * - Daily RSI near 40 (38-45 scan zone)
 * - Daily RSI turning upward
 * - A bullish/green signal candle forms at the daily inflection point
 * - R:R >= 1:3
 *
 * The signal candle is the alert candle. Entry is above its high and the
 * initial stop is below its low. Volume, CIP, small-candle and second-test
 * characteristics improve the score but are not mandatory for a regular GFS.
 */
export function evaluateGfs(
  input: GfsInput,
  config = { trendRsi: 60, zoneLow: 38, zoneHigh: 45, minVolume: 1.5, minRiskReward: 3 },
): GfsResult {
  const monthlyTrend = input.monthlyRsi > config.trendRsi;
  const weeklyTrend = input.weeklyRsi > config.trendRsi;
  const dailyZone = input.dailyRsi >= config.zoneLow && input.dailyRsi <= config.zoneHigh;
  const dailyTurningUp = input.dailyRsi > input.dailyRsiPrevious;
  const volumeConfirmed = input.relativeVolume >= config.minVolume;

  const risk = Math.max(input.entry - input.setupLow, 0);
  const reward = Math.max(input.target - input.entry, 0);
  const riskReward = risk > 0 ? reward / risk : 0;
  const riskRewardConfirmed = riskReward >= config.minRiskReward;

  // READY remains strict. A high score alone can never create a READY signal.
  const gfsReady =
    monthlyTrend &&
    weeklyTrend &&
    dailyZone &&
    dailyTurningUp &&
    input.confirmation &&
    riskRewardConfirmed;

  let setupType = 'Regular GFS';
  if (input.secondTest) setupType = 'Double Bottom GFS';
  else if (input.smallCandle) setupType = 'Small Candle GFS';
  if (input.cip && gfsReady) setupType += ' + CIP';

  // Transparent 10-point conviction score.
  // Unlike the old binary score, near-misses receive partial credit, so a
  // stock such as SBIN (monthly 58.6 / weekly 50.3 / daily 44.5) ranks as a
  // meaningful forming candidate without being incorrectly marked READY.
  let score = 0;

  // Monthly trend: 2 points when confirmed, partial credit when approaching 60.
  if (input.monthlyRsi > config.trendRsi) score += 2;
  else if (input.monthlyRsi >= 55) score += 1.5;
  else if (input.monthlyRsi >= 50) score += 1;
  else if (input.monthlyRsi >= 45) score += 0.5;

  // Weekly trend: same 2-point hierarchy.
  if (input.weeklyRsi > config.trendRsi) score += 2;
  else if (input.weeklyRsi >= 55) score += 1.5;
  else if (input.weeklyRsi >= 50) score += 1;
  else if (input.weeklyRsi >= 45) score += 0.5;

  // Daily RSI: 2 points in the 38-45 GFS zone, partial credit near the zone.
  if (dailyZone) score += 2;
  else if (input.dailyRsi >= 45 && input.dailyRsi <= 50) score += 1.5;
  else if (input.dailyRsi >= 35 && input.dailyRsi < 38) score += 1.5;
  else if ((input.dailyRsi > 50 && input.dailyRsi <= 55) || (input.dailyRsi >= 30 && input.dailyRsi < 35)) score += 1;

  if (dailyTurningUp) score += 1;
  if (input.confirmation) score += 1;
  if (riskRewardConfirmed) score += 1;
  else if (riskReward >= 2) score += 0.5;

  if (volumeConfirmed) score += 0.5;
  if (input.smallCandle || input.secondTest || input.cip) score += 0.5;

  return {
    monthlyTrend,
    weeklyTrend,
    dailyZone,
    dailyTurningUp,
    volumeConfirmed,
    riskRewardConfirmed,
    gfsReady,
    setupType,
    score: Number(Math.min(score, 10).toFixed(1)),
    riskReward: Number(riskReward.toFixed(2)),
  };
}
