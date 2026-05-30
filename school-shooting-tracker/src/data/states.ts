// State-level structural data used for the risk-factor analysis.
//
// Sources (publicly available):
// - Population: US Census Bureau 2023 estimates
// - Households with firearms (%): RAND State-Level Estimates of Household
//   Firearm Ownership (latest available, ~2016, used as relative ranking)
// - Gun Law Strength (Giffords scorecard, lower = weaker, higher = stronger):
//   https://giffords.org/lawcenter/resources/scorecard/
// - K-12 student count: NCES Common Core of Data, 2022-23
//
// All figures are approximate and intended for relative comparison only.

export interface StateData {
  code: string;
  name: string;
  population: number;        // total population, millions
  studentsK12: number;       // public K-12 students, millions
  householdGunPct: number;   // % of households with at least one firearm (RAND est.)
  gunLawScore: number;       // Giffords letter grade -> numeric (0=F, 4=A)
  region: "Northeast" | "Midwest" | "South" | "West";
}

export const states: StateData[] = [
  { code: "AL", name: "Alabama", population: 5.11, studentsK12: 0.74, householdGunPct: 48, gunLawScore: 0, region: "South" },
  { code: "AK", name: "Alaska", population: 0.73, studentsK12: 0.13, householdGunPct: 65, gunLawScore: 0, region: "West" },
  { code: "AZ", name: "Arizona", population: 7.43, studentsK12: 1.13, householdGunPct: 46, gunLawScore: 1, region: "West" },
  { code: "AR", name: "Arkansas", population: 3.07, studentsK12: 0.48, householdGunPct: 58, gunLawScore: 0, region: "South" },
  { code: "CA", name: "California", population: 38.97, studentsK12: 5.85, householdGunPct: 20, gunLawScore: 4, region: "West" },
  { code: "CO", name: "Colorado", population: 5.88, studentsK12: 0.88, householdGunPct: 45, gunLawScore: 3, region: "West" },
  { code: "CT", name: "Connecticut", population: 3.62, studentsK12: 0.51, householdGunPct: 23, gunLawScore: 4, region: "Northeast" },
  { code: "DE", name: "Delaware", population: 1.03, studentsK12: 0.14, householdGunPct: 26, gunLawScore: 3, region: "South" },
  { code: "FL", name: "Florida", population: 22.61, studentsK12: 2.92, householdGunPct: 32, gunLawScore: 1, region: "South" },
  { code: "GA", name: "Georgia", population: 11.03, studentsK12: 1.74, householdGunPct: 40, gunLawScore: 0, region: "South" },
  { code: "HI", name: "Hawaii", population: 1.44, studentsK12: 0.18, householdGunPct: 14, gunLawScore: 4, region: "West" },
  { code: "ID", name: "Idaho", population: 1.96, studentsK12: 0.31, householdGunPct: 60, gunLawScore: 0, region: "West" },
  { code: "IL", name: "Illinois", population: 12.55, studentsK12: 1.85, householdGunPct: 27, gunLawScore: 4, region: "Midwest" },
  { code: "IN", name: "Indiana", population: 6.86, studentsK12: 1.05, householdGunPct: 41, gunLawScore: 0, region: "Midwest" },
  { code: "IA", name: "Iowa", population: 3.21, studentsK12: 0.51, householdGunPct: 43, gunLawScore: 1, region: "Midwest" },
  { code: "KS", name: "Kansas", population: 2.94, studentsK12: 0.49, householdGunPct: 41, gunLawScore: 0, region: "Midwest" },
  { code: "KY", name: "Kentucky", population: 4.53, studentsK12: 0.65, householdGunPct: 47, gunLawScore: 0, region: "South" },
  { code: "LA", name: "Louisiana", population: 4.57, studentsK12: 0.69, householdGunPct: 50, gunLawScore: 0, region: "South" },
  { code: "ME", name: "Maine", population: 1.40, studentsK12: 0.17, householdGunPct: 47, gunLawScore: 2, region: "Northeast" },
  { code: "MD", name: "Maryland", population: 6.18, studentsK12: 0.89, householdGunPct: 28, gunLawScore: 4, region: "South" },
  { code: "MA", name: "Massachusetts", population: 7.00, studentsK12: 0.91, householdGunPct: 17, gunLawScore: 4, region: "Northeast" },
  { code: "MI", name: "Michigan", population: 10.04, studentsK12: 1.42, householdGunPct: 39, gunLawScore: 2, region: "Midwest" },
  { code: "MN", name: "Minnesota", population: 5.74, studentsK12: 0.87, householdGunPct: 41, gunLawScore: 2, region: "Midwest" },
  { code: "MS", name: "Mississippi", population: 2.94, studentsK12: 0.43, householdGunPct: 51, gunLawScore: 0, region: "South" },
  { code: "MO", name: "Missouri", population: 6.20, studentsK12: 0.86, householdGunPct: 49, gunLawScore: 0, region: "Midwest" },
  { code: "MT", name: "Montana", population: 1.13, studentsK12: 0.15, householdGunPct: 60, gunLawScore: 0, region: "West" },
  { code: "NE", name: "Nebraska", population: 1.98, studentsK12: 0.33, householdGunPct: 38, gunLawScore: 1, region: "Midwest" },
  { code: "NV", name: "Nevada", population: 3.19, studentsK12: 0.49, householdGunPct: 38, gunLawScore: 3, region: "West" },
  { code: "NH", name: "New Hampshire", population: 1.40, studentsK12: 0.17, householdGunPct: 38, gunLawScore: 1, region: "Northeast" },
  { code: "NJ", name: "New Jersey", population: 9.29, studentsK12: 1.36, householdGunPct: 14, gunLawScore: 4, region: "Northeast" },
  { code: "NM", name: "New Mexico", population: 2.11, studentsK12: 0.32, householdGunPct: 49, gunLawScore: 2, region: "West" },
  { code: "NY", name: "New York", population: 19.57, studentsK12: 2.49, householdGunPct: 18, gunLawScore: 4, region: "Northeast" },
  { code: "NC", name: "North Carolina", population: 10.84, studentsK12: 1.49, householdGunPct: 41, gunLawScore: 1, region: "South" },
  { code: "ND", name: "North Dakota", population: 0.78, studentsK12: 0.12, householdGunPct: 51, gunLawScore: 0, region: "Midwest" },
  { code: "OH", name: "Ohio", population: 11.79, studentsK12: 1.65, householdGunPct: 36, gunLawScore: 0, region: "Midwest" },
  { code: "OK", name: "Oklahoma", population: 4.05, studentsK12: 0.70, householdGunPct: 50, gunLawScore: 0, region: "South" },
  { code: "OR", name: "Oregon", population: 4.23, studentsK12: 0.55, householdGunPct: 42, gunLawScore: 3, region: "West" },
  { code: "PA", name: "Pennsylvania", population: 12.96, studentsK12: 1.71, householdGunPct: 36, gunLawScore: 2, region: "Northeast" },
  { code: "RI", name: "Rhode Island", population: 1.10, studentsK12: 0.14, householdGunPct: 14, gunLawScore: 3, region: "Northeast" },
  { code: "SC", name: "South Carolina", population: 5.37, studentsK12: 0.78, householdGunPct: 45, gunLawScore: 0, region: "South" },
  { code: "SD", name: "South Dakota", population: 0.92, studentsK12: 0.14, householdGunPct: 56, gunLawScore: 0, region: "Midwest" },
  { code: "TN", name: "Tennessee", population: 7.13, studentsK12: 1.02, householdGunPct: 51, gunLawScore: 0, region: "South" },
  { code: "TX", name: "Texas", population: 30.50, studentsK12: 5.50, householdGunPct: 45, gunLawScore: 0, region: "South" },
  { code: "UT", name: "Utah", population: 3.42, studentsK12: 0.68, householdGunPct: 47, gunLawScore: 0, region: "West" },
  { code: "VT", name: "Vermont", population: 0.65, studentsK12: 0.08, householdGunPct: 51, gunLawScore: 1, region: "Northeast" },
  { code: "VA", name: "Virginia", population: 8.72, studentsK12: 1.26, householdGunPct: 39, gunLawScore: 3, region: "South" },
  { code: "WA", name: "Washington", population: 7.81, studentsK12: 1.10, householdGunPct: 37, gunLawScore: 3, region: "West" },
  { code: "WV", name: "West Virginia", population: 1.77, studentsK12: 0.25, householdGunPct: 58, gunLawScore: 0, region: "South" },
  { code: "WI", name: "Wisconsin", population: 5.91, studentsK12: 0.81, householdGunPct: 44, gunLawScore: 1, region: "Midwest" },
  { code: "WY", name: "Wyoming", population: 0.58, studentsK12: 0.09, householdGunPct: 66, gunLawScore: 0, region: "West" },
  { code: "DC", name: "District of Columbia", population: 0.68, studentsK12: 0.09, householdGunPct: 9, gunLawScore: 4, region: "South" },
];

export const stateByCode: Record<string, StateData> = Object.fromEntries(
  states.map((s) => [s.code, s])
);
