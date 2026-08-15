// First-pass opportunity hints — research only, not job guarantees.
const WATER_HEATER_RE = /water\s*heater|wh\b|tankless/i;
const REPIPE_RE = /repipe|re-pipe|repiping/i;

function yearsSince(dateStr) {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (365.25 * 24 * 3600 * 1000);
}

/**
 * @param {{ parcel?, building?, permits?, equipmentAge?, flood? }} groups
 */
function assembleOpportunities(groups = {}) {
  const hints = [];
  const yearBuilt =
    (groups.parcel && groups.parcel.data && groups.parcel.data.yearBuilt) ||
    (groups.building && groups.building.data && groups.building.data.yearBuilt) ||
    (groups.equipmentAge && groups.equipmentAge.data && groups.equipmentAge.data.propertyYearBuilt);
  const yb = Number(yearBuilt);
  const ageYears = Number.isFinite(yb) && yb > 1800 ? new Date().getFullYear() - yb : null;

  const plumbing =
    (groups.permits && groups.permits.data && groups.permits.data.plumbing) || [];
  const coverageNote =
    groups.permits && groups.permits.data && groups.permits.data.coverageWindow
      ? 'Permit history is limited to active municipal scrape windows (~90 days) — not a full lifetime record.'
      : null;

  const hasWhPermit = plumbing.some((p) =>
    WATER_HEATER_RE.test([p.type, p.subtype, p.description].filter(Boolean).join(' '))
  );
  const hasRepipe = plumbing.some((p) =>
    REPIPE_RE.test([p.type, p.subtype, p.description].filter(Boolean).join(' '))
  );
  const lastPlumb =
    groups.equipmentAge && groups.equipmentAge.data && groups.equipmentAge.data.lastPlumbingWorkDate;
  const yearsSincePlumb = yearsSince(lastPlumb);

  if (ageYears != null && ageYears >= 40 && !hasRepipe) {
    hints.push({
      id: 'aging_supply_drain',
      title: 'Aging property — consider supply/drain condition',
      reason: `Structure ~${ageYears} years old with no recent Cached repipe permit in the scrape window.`,
      weight: 35,
    });
  }
  if (ageYears != null && ageYears >= 12 && !hasWhPermit) {
    hints.push({
      id: 'water_heater_age_band',
      title: 'Water heater replacement band',
      reason: `Property age ~${ageYears} years and no water-heater permit in the Cached window.`,
      weight: 30,
    });
  }
  if (hasWhPermit) {
    hints.push({
      id: 'recent_water_heater',
      title: 'Recent water heater work on record',
      reason: 'A Cached water-heater-related permit matched — lower urgency for like-for-like replacement upsell.',
      weight: -15,
    });
  }
  if (yearsSincePlumb != null && yearsSincePlumb < 1) {
    hints.push({
      id: 'recent_plumbing',
      title: 'Recent plumbing permit activity',
      reason: `Last plumbing-related permit date ~${yearsSincePlumb.toFixed(1)} years ago (within Cached window).`,
      weight: -10,
    });
  }
  if (
    groups.flood &&
    groups.flood.status === 'live' &&
    groups.flood.data &&
    String(groups.flood.data.sfha || '').toUpperCase() === 'T'
  ) {
    hints.push({
      id: 'sfha_flood',
      title: 'SFHA flood zone',
      reason: `Flood zone ${groups.flood.data.zone || 'SFHA'} — note elevation/backflow context for the tech.`,
      weight: 15,
    });
  }

  if (!hints.length && ageYears == null && !plumbing.length) {
    return {
      status: 'unavailable',
      source: 'spi-opportunities',
      label: 'research_hint',
      disclaimer:
        'Research hints only — not confirmed jobs or leads. Insufficient inputs to score.',
      data: null,
      message: 'Need year built and/or plumbing permits to score opportunities.',
    };
  }

  let score = 40;
  for (const h of hints) score += h.weight;
  score = Math.max(0, Math.min(100, score));
  hints.sort((a, b) => b.weight - a.weight);

  return {
    status: 'cached',
    source: 'yearBuilt + Cached plumbing permits + flood',
    label: 'research_hint',
    disclaimer:
      'Research hints only — not confirmed jobs, leads, or sales promises. ' +
      (coverageNote || 'Verify on official portals before dispatch decisions.'),
    data: {
      score,
      ranked: hints.map(({ id, title, reason }) => ({ id, title, reason })),
      inputsUsed: {
        propertyAgeYears: ageYears,
        plumbingPermitCount: plumbing.length,
        floodSfha: groups.flood && groups.flood.data ? groups.flood.data.sfha : null,
      },
    },
  };
}

module.exports = { assembleOpportunities };
