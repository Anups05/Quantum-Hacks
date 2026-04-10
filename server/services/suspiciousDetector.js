/**
 * Suspicious Pattern Detection Engine
 * Detects fake entries and suspicious visitor behavior
 */

function detectSuspiciousPatterns(phone, flat, timestamp, visitorHistory) {
  const flags = [];
  const now = new Date(timestamp);

  // Pattern 1: Same visitor → 3+ different flats in the same day
  const todayVisits = (visitorHistory || []).filter(v => {
    const vDate = new Date(v.timestamp);
    return v.phone === phone &&
      vDate.toDateString() === now.toDateString();
  });
  const uniqueFlats = new Set(todayVisits.map(v => v.flat));
  if (uniqueFlats.size >= 3) {
    flags.push({
      type: 'multi-flat',
      severity: 'high',
      message: `Unusual multi-flat activity: visited ${uniqueFlats.size} different flats today`,
    });
  }

  // Pattern 2: Rejected 2+ times in 7 days
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentRejections = (visitorHistory || []).filter(v =>
    v.phone === phone && v.status === 'rejected' && new Date(v.timestamp) > weekAgo
  );
  if (recentRejections.length >= 2) {
    flags.push({
      type: 'repeated-rejection',
      severity: 'high',
      message: `Repeated rejection attempts: rejected ${recentRejections.length} times in 7 days`,
    });
  }

  // Pattern 3: Late night entry (12 AM – 5 AM)
  const hour = now.getHours();
  if (hour >= 0 && hour < 5) {
    flags.push({
      type: 'late-night',
      severity: 'medium',
      message: 'Late night entry attempt (12 AM – 5 AM)',
    });
  }

  // Pattern 4: High risk visitor (trust score < 40)
  // This would be checked with the trust score calculation

  return flags;
}

/**
 * Calculate visitor trust score (0-100)
 */
function calculateTrustScore(visitorHistory) {
  let score = 50; // Base score

  if (!visitorHistory || visitorHistory.length === 0) return score;

  for (const visit of visitorHistory) {
    if (visit.status === 'approved' || visit.status === 'checked_in' || visit.status === 'checked_out') {
      score += 10;
    }
    if (visit.status === 'rejected') {
      score -= 15;
    }
    if (visit.faceMatch === 'mismatch') {
      score -= 30;
    }
  }

  // Clamp score
  return Math.max(0, Math.min(100, score));
}

module.exports = { detectSuspiciousPatterns, calculateTrustScore };
