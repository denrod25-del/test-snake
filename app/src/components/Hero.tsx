import { COUNTIES } from '../data/counties';
import { FALLBACK_UPCOMING } from '../data/schedules';
import { useUpcoming } from '../hooks/useUpcoming';

export function Hero() {
  const upcoming = useUpcoming();
  const onlineCount = COUNTIES.filter((c) => c.format === 'online').length;
  const upcomingCount = Object.values(upcoming ?? FALLBACK_UPCOMING).reduce((s, arr) => s + arr.length, 0);

  return (
    <section className="hero">
      <div className="hero-inner">
        <div>
          <div className="eyebrow">Tax Deed Sales · Florida Statewide</div>
          <h1 className="headline">A Disciplined Reference for the <em>Serious</em> Investor.</h1>
          <p className="lede">
            Every Florida county. Every Clerk. Every online auction platform.
            Verified, organized, and updated — so your due diligence starts on solid ground.
          </p>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <div className="stat-num">{COUNTIES.length}</div>
            <div className="stat-lbl">Counties</div>
          </div>
          <div className="stat">
            <div className="stat-num">{onlineCount}</div>
            <div className="stat-lbl">Online Auctions</div>
          </div>
          <div className="stat">
            <div className="stat-num">{upcomingCount}</div>
            <div className="stat-lbl">Upcoming Sales</div>
          </div>
        </div>
      </div>
    </section>
  );
}
