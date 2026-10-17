// Wilson score interval for the share of positive votes. With few votes the interval is wide,
// so a handful of votes can't present itself as a confident consensus.
export function wilsonInterval(positive: number, total: number, z = 1.96) {
  if (total <= 0) return { lower: 0, upper: 0 };
  const p = positive / total;
  const denominator = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return { lower: Math.max(0, (centre - margin) / denominator), upper: Math.min(1, (centre + margin) / denominator) };
}

export type Confidence = 'none' | 'low' | 'medium' | 'high';

export function confidenceFor(total: number, positive: number): { level: Confidence; lower: number; upper: number; marginPts: number } {
  const { lower, upper } = wilsonInterval(positive, total);
  const marginPts = Math.round(((upper - lower) / 2) * 100);
  const level: Confidence = total === 0 ? 'none' : total < 10 || marginPts > 20 ? 'low' : total < 50 || marginPts > 10 ? 'medium' : 'high';
  return { level, lower, upper, marginPts };
}
