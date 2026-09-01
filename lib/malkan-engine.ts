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

  // Core GFS conditions. Volume/CIP are quality filters, not prerequisites.
  const gfsReady =
    monthlyTrend &&
    weeklyTrend &&
    dailyZone &&
    dailyTurningUp &&
    input.confirmation &&
    riskRewardConfirmed;

  let setupType = "Regular GFS";
  if (input.secondTest) setupType = "Double Bottom GFS";
  else if (input.smallCandle) setupType = "Small Candle GFS";
  if (input.cip && gfsReady) setupType += " + CIP";

  // Score the setup on a transparent 10-point scale.
  // Core alignment carries most of the weight; optional quality factors add
  // conviction without making a regular GFS impossible to qualify.
  let score = 0;
  if (monthlyTrend) score += 2;
  if (weeklyTrend) score += 2;
  if (dailyZone) score += 2;
  if (dailyTurningUp) score += 1;
  if (input.confirmation) score += 1;
  if (riskRewardConfirmed) score += 1;
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
