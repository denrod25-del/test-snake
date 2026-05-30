# US School Shootings Tracker

A public-information HUD that visualizes documented school shootings in the United States and surfaces structural risk factors at the state level.

## What it does

- **Overview** — National KPIs, yearly trend, top states, incident type/level/relationship breakdowns
- **Incident Map** — Interactive Leaflet map of every incident with category & year filters
- **Trends** — Time-series, by decade, by region, shooter age, weapon type
- **Risk Factors** — Composite state risk score from historical rate + gun prevalence + gun-law strength + student exposure, plus correlation analysis and an honest "what the data does NOT show" section
- **Methodology** — Sources, calculation, and explicit limitations

## What it deliberately does NOT do

- It does **not** predict where the next shooting will happen. That would be statistically irresponsible (rare events, ~130k schools) and ethically risky.
- It does **not** use ethnicity, race, or community identifiers as inputs.
- The bundled dataset is a **curated subset** of well-documented incidents, not the full K-12 SSDB.

## Tech

- Vite + React + TypeScript
- Tailwind CSS (custom dark HUD theme)
- React Router
- Leaflet + react-leaflet (CARTO dark basemap, no API key needed)
- Recharts

## Running

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # preview production build
```

## Extending the dataset

Replace `src/data/incidents.ts` with a JSON export of the [K-12 School Shooting Database](https://www.chds.us/sssc/data-map/) CSV. The interface to match is at the top of that file.

Replace `src/data/states.ts` with the latest figures from:

- US Census Bureau (population)
- NCES Common Core of Data (K-12 students)
- RAND State-Level Estimates of Household Firearm Ownership
- Giffords Law Center Annual Scorecard (mapped F=0 → A=4)

## Sources used in this app

- K-12 School Shooting Database (CHDS / Naval Postgraduate School)
- Washington Post School Shootings Database
- Everytown for Gun Safety
- US Secret Service NTAC reports
- FBI Active Shooter studies
- RAND Gun Policy in America

See the in-app **Methodology** page for full citations and limitations.
