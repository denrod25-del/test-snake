import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { OfficeLayout, TechLayout } from './layouts/Layouts';
import { BookJobPage } from './pages/BookJobPage';
import { DispatchBoardPage } from './pages/DispatchBoardPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { LoginPage } from './pages/LoginPage';
import { PricebookPage } from './pages/PricebookPage';
import { PublicRequestPage } from './pages/PublicRequestPage';
import { RequestQueuePage } from './pages/RequestQueuePage';
import { TechJobListPage } from './pages/TechJobListPage';
import { TeamPage, TodayMoneyPage } from './pages/TeamMoneyPages';
import { TodayPage } from './pages/TodayPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/r/:shopSlug" element={<PublicRequestPage />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <OfficeLayout />
          </RequireAuth>
        }
      >
        <Route index element={<TodayPage />} />
        <Route path="book" element={<BookJobPage />} />
        <Route path="requests" element={<RequestQueuePage />} />
        <Route path="dispatch" element={<DispatchBoardPage />} />
        <Route path="pricebook" element={<PricebookPage />} />
        <Route path="money" element={<TodayMoneyPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="jobs/:jobId" element={<JobDetailPage mode="office" />} />
      </Route>
      <Route
        path="/tech"
        element={
          <RequireAuth>
            <TechLayout />
          </RequireAuth>
        }
      >
        <Route index element={<TechJobListPage />} />
        <Route path="jobs/:jobId" element={<JobDetailPage mode="tech" />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
