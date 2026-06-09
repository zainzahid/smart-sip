import { useState, useEffect } from 'react';
import { AllocationManager } from './components/AllocationManager';
import { SipSection } from './components/SipSection';
import { LoadingSpinner } from './components/LoadingSpinner';
import {
  loadAllocations,
  saveAllocations,
  loadPreferences,
  savePreferences,
} from './services/firebaseService';
import { isFirebaseConfigured } from './config/firebase';
import type { Allocation } from './types';

export default function App() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [lastSipAmount, setLastSipAmount] = useState<number | undefined>();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setBootstrapping(false);
      return;
    }

    Promise.all([loadAllocations(), loadPreferences()])
      .then(([allocs, prefs]) => {
        setAllocations(allocs);
        setLastSipAmount(prefs.lastSipAmount);
      })
      .catch(err =>
        setBootError(err?.message ?? 'Failed to load data from Firebase'),
      )
      .finally(() => setBootstrapping(false));
  }, []);

  function handleAdd(alloc: Allocation) {
    setAllocations(prev => [...prev, alloc]);
  }

  function handleRemove(symbol: string) {
    setAllocations(prev => prev.filter(a => a.symbol !== symbol));
  }

  async function handleSave() {
    if (isFirebaseConfigured) await saveAllocations(allocations);
  }

  async function handleAmountChange(amount: number) {
    setLastSipAmount(amount);
    if (isFirebaseConfigured) savePreferences({ lastSipAmount: amount }).catch(() => {/* non-critical */});
  }

  if (bootstrapping) {
    return (
      <div className="boot-screen">
        <LoadingSpinner size={36} />
        <span>Loading Smart SIP…</span>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">◈</span>
            <span className="logo-name">Smart SIP</span>
          </div>
          <span className="header-tag">PSX Portfolio Calculator</span>
        </div>
      </header>

      {bootError ? (
        <div className="boot-error">
          <strong>Setup required:</strong> {bootError}
        </div>
      ) : (
        <main className="app-main">
          <div className="layout">
            <aside className="col-left">
              <AllocationManager
                allocations={allocations}
                onAdd={handleAdd}
                onRemove={handleRemove}
                onSave={handleSave}
              />
            </aside>
            <section className="col-right">
              <SipSection
                allocations={allocations}
                initialAmount={lastSipAmount}
                onAmountChange={handleAmountChange}
              />
            </section>
          </div>
        </main>
      )}

      <footer className="app-footer">
        Smart SIP · Personal PSX Utility
        {/* TODO: Rebalancing engine · Historical SIP records */}
      </footer>
    </div>
  );
}
