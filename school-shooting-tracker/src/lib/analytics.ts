import { incidents, type Incident } from "../data/incidents";
import { states, stateByCode, type StateData } from "../data/states";

export interface StateAggregate {
  state: StateData;
  incidentCount: number;
  killed: number;
  wounded: number;
  ratePerMillionStudents: number; // incidents per million K-12 students (rough)
}

export function aggregateByState(filtered: Incident[] = incidents): StateAggregate[] {
  const map = new Map<string, { count: number; killed: number; wounded: number }>();
  for (const inc of filtered) {
    const cur = map.get(inc.state) ?? { count: 0, killed: 0, wounded: 0 };
    cur.count += 1;
    cur.killed += inc.killed;
    cur.wounded += inc.wounded;
    map.set(inc.state, cur);
  }
  return states.map((s) => {
    const cur = map.get(s.code) ?? { count: 0, killed: 0, wounded: 0 };
    return {
      state: s,
      incidentCount: cur.count,
      killed: cur.killed,
      wounded: cur.wounded,
      ratePerMillionStudents: s.studentsK12 > 0 ? cur.count / s.studentsK12 : 0,
    };
  });
}

export interface YearAggregate {
  year: number;
  incidents: number;
  killed: number;
  wounded: number;
}

export function aggregateByYear(filtered: Incident[] = incidents): YearAggregate[] {
  const map = new Map<number, YearAggregate>();
  for (const inc of filtered) {
    const year = new Date(inc.date).getUTCFullYear();
    const cur = map.get(year) ?? { year, incidents: 0, killed: 0, wounded: 0 };
    cur.incidents += 1;
    cur.killed += inc.killed;
    cur.wounded += inc.wounded;
    map.set(year, cur);
  }
  const min = Math.min(...map.keys());
  const max = Math.max(...map.keys());
  const out: YearAggregate[] = [];
  for (let y = min; y <= max; y++) {
    out.push(map.get(y) ?? { year: y, incidents: 0, killed: 0, wounded: 0 });
  }
  return out;
}

export function countBy<T extends string>(
  arr: Incident[],
  key: (i: Incident) => T | undefined
): { name: T; value: number }[] {
  const map = new Map<T, number>();
  for (const inc of arr) {
    const k = key(inc);
    if (k === undefined) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

// Pearson correlation coefficient
export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

// Compute a normalized 0-100 "structural risk score" per state from publicly
// known correlated factors. NOT a probability, NOT a prediction of any
// individual school. Used only as a comparative heatmap.
export interface StateRisk {
  state: StateData;
  historicalRate: number;     // 0-1 normalized incidents per student
  gunPrevalence: number;      // 0-1 normalized household gun %
  weakLaws: number;           // 0-1 normalized (1 = weakest laws)
  studentBase: number;        // 0-1 normalized log students (population exposure)
  riskScore: number;          // 0-100 composite
}

export function computeStateRisk(): StateRisk[] {
  const agg = aggregateByState();
  const rateByCode = new Map(agg.map((a) => [a.state.code, a.ratePerMillionStudents]));

  const rates = states.map((s) => rateByCode.get(s.code) ?? 0);
  const guns = states.map((s) => s.householdGunPct);
  const laws = states.map((s) => 4 - s.gunLawScore); // invert so high = weak laws
  const logStudents = states.map((s) => Math.log(1 + s.studentsK12));

  const norm = (arr: number[]) => {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min || 1;
    return arr.map((v) => (v - min) / range);
  };
  const nRates = norm(rates);
  const nGuns = norm(guns);
  const nLaws = norm(laws);
  const nStudents = norm(logStudents);

  return states.map((s, i) => {
    // Weighted composite. Weights are illustrative; see Methodology page.
    const score =
      0.45 * nRates[i] + 0.25 * nGuns[i] + 0.20 * nLaws[i] + 0.10 * nStudents[i];
    return {
      state: s,
      historicalRate: nRates[i],
      gunPrevalence: nGuns[i],
      weakLaws: nLaws[i],
      studentBase: nStudents[i],
      riskScore: Math.round(score * 100),
    };
  });
}

export { stateByCode };
