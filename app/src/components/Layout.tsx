import { Outlet } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Masthead } from './Masthead';
import { Footer } from './Footer';
import { AuthModal } from './AuthModal';

export function Layout() {
  return (
    <>
      <Topbar />
      <Masthead />
      <Outlet />
      <Footer />
      <AuthModal />
    </>
  );
}
