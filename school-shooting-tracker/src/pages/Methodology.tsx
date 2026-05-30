import PageHeader from "../components/PageHeader";
import Panel from "../components/Panel";

export default function Methodology() {
  return (
    <div className="min-h-full">
      <PageHeader
        title="Methodology & Sources"
        subtitle="What this app is, what it isn't, and how the numbers were produced."
      />

      <div className="p-6 space-y-6 max-w-4xl">
        <Panel title="What this app is">
          <ul className="text-sm space-y-2 list-disc pl-5">
            <li>
              A public-information dashboard summarizing well-documented school
              shooting incidents in the United States.
            </li>
            <li>
              A visualization of structural factors (firearm prevalence, gun-law
              strength, student population) that correlate with state-level
              incident rates.
            </li>
            <li>
              An honest accounting of what the empirical literature does and
              does not show.
            </li>
          </ul>
        </Panel>

        <Panel title="What this app is NOT">
          <ul className="text-sm space-y-2 list-disc pl-5">
            <li>
              <strong>Not a prediction system.</strong> The "Risk Factors" page
              ranks states by structural conditions; it cannot and does not
              predict where any individual shooting will occur. School shootings
              are statistically rare events relative to the ~130,000 K-12
              schools in the US, and any point-prediction model would have an
              unacceptable false-positive rate.
            </li>
            <li>
              <strong>Not a complete dataset.</strong> The bundled list is a
              curated subset of well-documented incidents drawn from public
              reporting. The full K-12 SSDB lists thousands of events; many are
              non-fatal, accidental, off-hours, or suicide.
            </li>
            <li>
              <strong>Not a stigmatization tool.</strong> The risk model
              deliberately uses only state-level structural variables — never
              ethnicity, race, religion, or community-specific identifiers.
            </li>
          </ul>
        </Panel>

        <Panel title="Data Sources">
          <ul className="text-sm space-y-3">
            <li>
              <strong>K-12 School Shooting Database</strong> (CHDS / Naval
              Postgraduate School): the most comprehensive open database of
              K-12 incidents from 1970 to present.{" "}
              <a
                href="https://www.chds.us/sssc/data-map/"
                className="text-hud-info hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                chds.us/sssc/data-map
              </a>
            </li>
            <li>
              <strong>Washington Post School Shootings Database</strong>: vetted
              database since Columbine.{" "}
              <a
                href="https://www.washingtonpost.com/education/interactive/school-shootings-database/"
                className="text-hud-info hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                washingtonpost.com/education/interactive/school-shootings-database
              </a>
            </li>
            <li>
              <strong>Everytown for Gun Safety</strong>: gunfire on school
              grounds tracker.{" "}
              <a
                href="https://everytownresearch.org/maps/gunfire-on-school-grounds/"
                className="text-hud-info hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                everytownresearch.org
              </a>
            </li>
            <li>
              <strong>RAND State-Level Estimates of Household Firearm
              Ownership</strong>: used for gun prevalence proxy.
            </li>
            <li>
              <strong>Giffords Law Center Annual Scorecard</strong>: used for
              gun-law strength proxy (letter grades mapped 0–4).
            </li>
            <li>
              <strong>NCES Common Core of Data</strong>: K-12 student
              population by state.
            </li>
            <li>
              <strong>US Census Bureau</strong>: state population estimates.
            </li>
          </ul>
        </Panel>

        <Panel title="Risk Score Calculation">
          <p className="text-sm mb-3">
            For each state we compute four normalized 0–1 components and combine
            them into a 0–100 composite:
          </p>
          <pre className="text-xs font-mono bg-hud-bg p-4 rounded border border-hud-border overflow-x-auto">
{`risk = 0.45 * historicalRate
     + 0.25 * gunPrevalence
     + 0.20 * weakLaws
     + 0.10 * studentBase`}
          </pre>
          <p className="text-xs text-hud-dim mt-3">
            Weights are illustrative and chosen to emphasize empirical history
            while still surfacing structural factors. With only ~50 states the
            statistical power is limited; treat this as a comparative tool, not
            an inferential model. A more rigorous approach would require
            county-level data, multilevel modeling, and explicit confidence
            intervals.
          </p>
        </Panel>

        <Panel title="What the academic literature says">
          <ul className="text-sm space-y-2 list-disc pl-5">
            <li>
              <strong>US Secret Service NTAC (2019, 2021):</strong> reviews of
              targeted school violence find attackers almost universally
              experienced personal stressors and grievances; most communicated
              their intent ("leakage") in advance.
            </li>
            <li>
              <strong>FBI Active Shooter studies:</strong> the typical
              K-12 attacker is a current or former student, male, with access
              to a firearm in the home.
            </li>
            <li>
              <strong>RAND Gun Policy in America:</strong> the strongest
              evidence supports child-access prevention laws, secure storage
              requirements, and minimum-age purchase laws as reducing youth
              firearm injuries.
            </li>
            <li>
              <strong>JAMA / NEJM studies:</strong> state-level firearm
              prevalence correlates positively with rates of firearm-related
              death, including in school settings.
            </li>
          </ul>
        </Panel>

        <Panel title="How to extend this app">
          <ul className="text-sm space-y-2 list-disc pl-5">
            <li>
              Replace <code className="text-hud-info">src/data/incidents.ts</code>{" "}
              with a JSON export of the K-12 SSDB CSV (columns must match the{" "}
              <code className="text-hud-info">Incident</code> interface).
            </li>
            <li>
              Replace <code className="text-hud-info">src/data/states.ts</code>{" "}
              with the latest Census / NCES / Giffords / RAND figures.
            </li>
            <li>
              For a real predictive model, move to county-level features
              (poverty rate, urbanicity, school size, prior incidents) and a
              regularized regression — and report calibration metrics
              transparently.
            </li>
          </ul>
        </Panel>

        <p className="text-xs text-hud-dim text-center pt-4">
          Built as a public-information resource. Not affiliated with any of
          the data providers listed above.
        </p>
      </div>
    </div>
  );
}
