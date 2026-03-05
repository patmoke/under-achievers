export function calculatePoints(userPick, actualSpread, confidence = 1) {
  const difference = Math.abs(userPick - actualSpread);
  let basePoints = 0;
  if (difference === 0) basePoints = 10;
  else if (difference <= 0.5) basePoints = 8;
  else if (difference <= 1) basePoints = 6;
  else if (difference <= 2) basePoints = 4;
  else if (difference <= 3) basePoints = 2;
  else basePoints = 1;
  return basePoints * confidence;
}

export function getAccuracyColor(difference) {
  if (difference <= 1) return '#10b981';
  if (difference <= 3) return '#f59e0b';
  return '#ef4444';
}

export function formatSpread(spread) {
  if (spread === null || spread === undefined) return 'N/A';
  return spread > 0 ? `+${spread}` : `${spread}`;
}

export function formatRecord(predictions) {
  const wins = predictions.filter(p => p.accuracy_score >= 6).length;
  const losses = predictions.length - wins;
  return `${wins}-${losses}`;
}
