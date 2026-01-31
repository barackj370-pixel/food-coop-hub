import { useEffect, useState } from 'react';
import { supabase } from './services/supabaseClient';
import { getCurrentUserProfile } from './services/authService';

/* ───────── PORTALS (import your existing components) ───────── */
import LoginPage from './pages/LoginPage';

import MarketPortal from './portals/MarketPortal';
import FinancePortal from './portals/FinancePortal';
import AuditPortal from './portals/AuditPortal';
import BoardPortal from './portals/BoardPortal';
import SystemPortal from './portals/SystemPortal';

import UniversalLedger from './components/UniversalLedger';

type Portal =
  | 'MARKET'
  | 'FINANCE'
  | 'AUDIT'
  | 'BOARD'
  | 'SYSTEM';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [currentPortal, setCurrentPortal] = useState<Portal>('MARKET');
  const [loading, setLoading] = useState(true);

  /* ───────── AUTH STATE ───────── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);

        if (session) {
          const profile = await getCurrentUserProfile();
          setProfile(profile);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  /* ───────── ROLE → PORTAL ───────── */
  useEffect(() => {
    if (!profile) return;

    switch (profile.role) {
      case 'Sales Agent':
        setCurrentPortal('MARKET');
        break;

      case 'Finance Officer':
        setCurrentPortal('FINANCE');
        break;

      case 'Audit Officer':
        setCurrentPortal('AUDIT');
        break;

      case 'Director':
        setCurrentPortal('BOARD');
        break;

      case 'System Developer':
        setCurrentPortal('SYSTEM');
        break;

      default:
        setCurrentPortal('MARKET');
    }
  }, [profile]);

  /* ───────── GUARDS ───────── */
  if (loading) {
    return <div className="p-8">Loading system…</div>;
  }

  if (!session) {
    return <LoginPage />;
  }

  /* ───────── PORTAL RENDER ───────── */
  const renderPortal = () => {
    switch (currentPortal) {
      case 'MARKET':
        return <MarketPortal />;

      case 'FINANCE':
        return <FinancePortal />;

      case 'AUDIT':
        return <AuditPortal />;

      case 'BOARD':
        return <BoardPortal />;

      case 'SYSTEM':
        return <SystemPortal />;

      default:
        return <MarketPortal />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ───────── TOP BAR ───────── */}
      <header className="flex items-center justify-between px-6 py-3 bg-white shadow">
        <div>
          <strong>{profile?.name || profile?.email}</strong>
          <div className="text-sm text-gray-500">{profile?.role}</div>
        </div>

        <div className="flex gap-3">
          {/* Director sees all except System */}
          {profile?.role === 'Director' && (
            <>
              <button onClick={() => setCurrentPortal('MARKET')}>Market</button>
              <button onClick={() => setCurrentPortal('FINANCE')}>Finance</button>
              <button onClick={() => setCurrentPortal('AUDIT')}>Audit</button>
              <button onClick={() => setCurrentPortal('BOARD')}>Board</button>
            </>
          )}

          {/* System Developer sees everything */}
          {profile?.role === 'System Developer' && (
            <>
              <button onClick={() => setCurrentPortal('MARKET')}>Market</button>
              <button onClick={() => setCurrentPortal('FINANCE')}>Finance</button>
              <button onClick={() => setCurrentPortal('AUDIT')}>Audit</button>
              <button onClick={() => setCurrentPortal('BOARD')}>Board</button>
              <button onClick={() => setCurrentPortal('SYSTEM')}>System</button>
            </>
          )}

          <button
            onClick={() => supabase.auth.signOut()}
            className="text-red-600 font-semibold"
          >
            Logout
          </button>
        </div>
      </header>

      {/* ───────── MAIN ───────── */}
      <main className="p-6">
        {renderPortal()}

        {/* Universal ledger visible to ALL roles */}
        <section className="mt-10">
          <h2 className="font-bold mb-2">Universal Transaction Log</h2>
          <UniversalLedger />
        </section>
      </main>
    </div>
  );
}
