// Tiny, framework-free mean/std helper - deliberately mirrors the backend's
// `_mean_std` in vocal_features.py (same population-std convention, same
// None/empty/single-value handling) so the face-side and voice-side halves
// of a Milestone 6 calibration produce numbers on the same footing.

export function meanAndStd(values) {
  const clean = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (clean.length === 0) return { mean: null, std: null };
  if (clean.length === 1) return { mean: round2(clean[0]), std: 0 };

  const mean = clean.reduce((sum, v) => sum + v, 0) / clean.length;
  const variance = clean.reduce((sum, v) => sum + (v - mean) ** 2, 0) / clean.length;
  return { mean: round2(mean), std: round2(Math.sqrt(variance)) };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
