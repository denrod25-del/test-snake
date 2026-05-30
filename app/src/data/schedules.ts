import type { Schedule, UpcomingSale } from '../lib/types';

export const DEFAULT_SCHEDULE: Schedule = {
  weekday: 3,
  weeks: [1],
  time: '10:00 AM ET',
  note: 'Typical pattern; verify with Clerk.',
};

export const SCHEDULE: Record<string, Schedule> = {
  Alachua:        { weekday: 4, weeks: [1],       time: '10:00 AM ET' },
  Brevard:        { weekday: 3, weeks: [2],       time: '10:00 AM ET' },
  Broward:        { weekday: 3, weeks: [1, 3],    time: '10:00 AM ET' },
  Charlotte:      { weekday: 3, weeks: [3],       time: '10:00 AM ET' },
  Citrus:         { weekday: 4, weeks: [2],       time: '10:00 AM ET' },
  Clay:           { weekday: 4, weeks: [3],       time: '10:00 AM ET' },
  Collier:        { weekday: 3, weeks: [1],       time: '10:00 AM ET' },
  Duval:          { weekday: 1, weeks: [1, 2, 3, 4], time: '9:30 AM ET' },
  Escambia:       { weekday: 3, weeks: [3],       time: '9:00 AM ET' },
  Hernando:       { weekday: 3, weeks: [1],       time: '11:00 AM ET' },
  Hillsborough:   { weekday: 3, weeks: [1, 2, 3, 4], time: '10:00 AM ET' },
  'Indian River': { weekday: 3, weeks: [4],       time: '10:00 AM ET' },
  Lake:           { weekday: 4, weeks: [1],       time: '10:00 AM ET' },
  Lee:            { weekday: 3, weeks: [1, 2, 3, 4], time: '10:00 AM ET' },
  Manatee:        { weekday: 3, weeks: [2],       time: '11:00 AM ET' },
  Marion:         { weekday: 4, weeks: [3],       time: '10:00 AM ET' },
  Martin:         { weekday: 3, weeks: [3],       time: '10:00 AM ET' },
  'Miami-Dade':   { weekday: 3, weeks: [1, 2, 3, 4], time: '9:00 AM ET' },
  Monroe:         { weekday: 3, weeks: [3],       time: '11:00 AM ET' },
  Nassau:         { weekday: 4, weeks: [1],       time: '11:00 AM ET' },
  Okaloosa:       { weekday: 4, weeks: [4],       time: '10:00 AM ET' },
  Orange:         { weekday: 4, weeks: [1, 2, 3, 4], time: '10:00 AM ET' },
  Osceola:        { weekday: 4, weeks: [3],       time: '10:00 AM ET' },
  'Palm Beach':   { weekday: 3, weeks: [1, 2, 3, 4], time: '9:30 AM ET' },
  Pasco:          { weekday: 4, weeks: [1],       time: '10:00 AM ET' },
  Pinellas:       { weekday: 3, weeks: [2, 4],    time: '10:00 AM ET' },
  Polk:           { weekday: 3, weeks: [3],       time: '10:00 AM ET' },
  Putnam:         { weekday: 3, weeks: [3],       time: '9:00 AM ET' },
  'St. Johns':    { weekday: 3, weeks: [3],       time: '10:00 AM ET' },
  'St. Lucie':    { weekday: 3, weeks: [3],       time: '10:00 AM ET' },
  'Santa Rosa':   { weekday: 4, weeks: [4],       time: '9:00 AM ET' },
  Sarasota:       { weekday: 3, weeks: [3],       time: '9:00 AM ET' },
  Seminole:       { weekday: 3, weeks: [3],       time: '10:00 AM ET' },
  Volusia:        { weekday: 3, weeks: [1, 3],    time: '10:00 AM ET' },
};

export const VERIFIED_OVERRIDES: Record<string, string> = {};

export const VERIFIED_GLOBAL = '2026-04-18';

// Inline upcoming sales (replaced at runtime by sales.json fetch when present)
export const FALLBACK_UPCOMING: Record<string, UpcomingSale[]> = {
  Orange:         [{ date: '2026-04-22', count: 8,  opening: '$10,400 floor' }, { date: '2026-05-06', count: 12 }, { date: '2026-05-13', count: 9 }],
  'Miami-Dade':   [{ date: '2026-04-23', count: 24 }, { date: '2026-04-30', count: 18 }, { date: '2026-05-07', count: 21 }],
  Broward:        [{ date: '2026-04-22', count: 14 }, { date: '2026-05-06', count: 11 }],
  'Palm Beach':   [{ date: '2026-04-22', count: 9  }, { date: '2026-04-29', count: 7  }, { date: '2026-05-06', count: 10 }],
  Hillsborough:   [{ date: '2026-04-22', count: 16 }, { date: '2026-04-29', count: 11 }, { date: '2026-05-06', count: 13 }],
  Pinellas:       [{ date: '2026-04-22', count: 6  }, { date: '2026-05-13', count: 8  }],
  Lee:            [{ date: '2026-04-22', count: 5  }, { date: '2026-04-29', count: 8  }, { date: '2026-05-06', count: 6 }],
  Duval:          [{ date: '2026-04-21', count: 13 }, { date: '2026-04-28', count: 9  }, { date: '2026-05-05', count: 11 }],
  Polk:           [{ date: '2026-05-06', count: 4  }],
  Brevard:        [{ date: '2026-05-13', count: 7  }],
  Volusia:        [{ date: '2026-04-22', count: 5  }, { date: '2026-05-06', count: 6 }],
  Sarasota:       [{ date: '2026-05-13', count: 3  }],
  Manatee:        [{ date: '2026-05-13', count: 4  }],
  Collier:        [{ date: '2026-05-06', count: 6  }],
  Marion:         [{ date: '2026-05-13', count: 5  }],
  Pasco:          [{ date: '2026-05-06', count: 7  }],
  Lake:           [{ date: '2026-05-06', count: 4  }],
  Osceola:        [{ date: '2026-05-13', count: 3  }],
  Charlotte:      [{ date: '2026-05-13', count: 2  }],
  'St. Johns':    [{ date: '2026-04-29', count: 4  }],
  'St. Lucie':    [{ date: '2026-04-29', count: 3  }],
  Martin:         [{ date: '2026-05-13', count: 2  }],
  'Indian River': [{ date: '2026-04-29', count: 3  }],
  Seminole:       [{ date: '2026-05-13', count: 5  }],
};

export const SURPLUS_OVERRIDES: Record<string, { url: string; label: string }> = {};
