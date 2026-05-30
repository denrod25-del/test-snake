import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { Registry } from './pages/Registry';
import { CountyDetail } from './pages/CountyDetail';
import { Upcoming } from './pages/Upcoming';
import { Surplus } from './pages/Surplus';
import { Statute } from './pages/Statute';
import { Research } from './pages/Research';
import { Pricing } from './pages/Pricing';
import { Account } from './pages/Account';
import { SurplusHistory } from './pages/SurplusHistory';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!window.location.hash.startsWith('#statute-')) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Registry />} />
          <Route path="county/:slug" element={<CountyDetail />} />
          <Route path="upcoming"        element={<Upcoming />} />
          <Route path="surplus"         element={<Surplus />} />
          <Route path="surplus-history" element={<SurplusHistory />} />
          <Route path="statute"         element={<Statute />} />
          <Route path="research"        element={<Research />} />
          <Route path="pricing"         element={<Pricing />} />
          <Route path="account"         element={<Account />} />
          <Route path="privacy"         element={<Privacy />} />
          <Route path="terms"           element={<Terms />} />
          <Route path="*" element={<Registry />} />
        </Route>
      </Routes>
    </>
  );
}
