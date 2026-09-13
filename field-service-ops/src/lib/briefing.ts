export type TrustStatus = 'live' | 'cached' | 'unavailable' | 'coming_soon';

export interface BriefingGroup {
  status: TrustStatus;
  source?: string;
  payload?: Record<string, unknown>;
  message?: string;
}

export interface BriefingResponse {
  groups: {
    parcel?: BriefingGroup;
    building?: BriefingGroup;
    permits?: BriefingGroup;
    flood?: BriefingGroup;
    waterSewer?: BriefingGroup;
    opportunities?: BriefingGroup;
  };
}

/** Never invent Live/Cached values when the source says unavailable. */
export function normalizeBriefing(raw: BriefingResponse): BriefingResponse {
  const groups: BriefingResponse['groups'] = {};
  for (const [key, group] of Object.entries(raw.groups || {}) as Array<
    [keyof BriefingResponse['groups'], BriefingGroup | undefined]
  >) {
    if (!group) continue;
    if (group.status === 'unavailable' || group.status === 'coming_soon') {
      groups[key] = { status: group.status, message: group.message || 'No sourced data' };
      continue;
    }
    groups[key] = group;
  }
  return { groups };
}

export function trustLabel(status: TrustStatus): string {
  switch (status) {
    case 'live':
      return 'Live';
    case 'cached':
      return 'Cached';
    case 'coming_soon':
      return 'Coming Soon';
    default:
      return 'Unavailable';
  }
}
