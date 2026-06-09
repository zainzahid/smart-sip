import { useState, useRef } from 'react';
import type { Allocation } from '../types';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  allocations: Allocation[];
  onAdd: (alloc: Allocation) => void;
  onRemove: (symbol: string) => void;
  onSave: () => Promise<void>;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function AllocationManager({ allocations, onAdd, onRemove, onSave }: Props) {
  const [symbol, setSymbol] = useState('');
  const [pct, setPct] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const allocInputRef = useRef<HTMLInputElement>(null);

  const total = allocations.reduce((s, a) => s + a.allocation, 0);
  const isExact100 = Math.abs(total - 100) < 0.001;
  const totalState = isExact100 ? 'valid' : total > 100 ? 'over' : 'under';

  function handleAdd() {
    const sym = symbol.trim().toUpperCase();
    const val = parseFloat(pct);

    if (!sym) return setAddError('Symbol is required');
    if (!/^[A-Z]{1,8}$/.test(sym)) return setAddError('Symbol: 1–8 letters only');
    if (allocations.some(a => a.symbol === sym)) return setAddError(`${sym} already added`);
    if (isNaN(val) || val <= 0) return setAddError('Allocation must be > 0');
    if (val > 100) return setAddError('Allocation cannot exceed 100%');

    onAdd({ symbol: sym, allocation: val });
    setSymbol('');
    setPct('');
    setAddError(null);
  }

  async function handleSave() {
    setSaveStatus('saving');
    try {
      await onSave();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }

  const saveLabel =
    saveStatus === 'saving' ? null
    : saveStatus === 'saved' ? '✓ Saved'
    : saveStatus === 'error' ? 'Save Failed'
    : 'Save Allocations';

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Portfolio Allocations</h2>
        <span className={`total-badge ${totalState}`}>{total.toFixed(total % 1 === 0 ? 0 : 1)}%</span>
      </div>

      <div className="alloc-list">
        {allocations.length === 0 ? (
          <div className="empty-state">Add your first allocation below</div>
        ) : (
          allocations.map(a => (
            <div key={a.symbol} className="alloc-row">
              <span className={`sym-badge ${a.symbol === 'CASH' ? 'cash' : ''}`}>
                {a.symbol}
              </span>
              <span className="alloc-pct">{a.allocation}%</span>
              <button
                className="remove-btn"
                onClick={() => onRemove(a.symbol)}
                aria-label={`Remove ${a.symbol}`}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {allocations.length > 0 && (
        <div className="alloc-total-row">
          <span>Total</span>
          <span className={`total-val ${isExact100 ? 'valid' : 'invalid'}`}>
            {total.toFixed(total % 1 === 0 ? 0 : 1)}%
            {isExact100 ? ' ✓' : ` (${total > 100 ? '+' : ''}${(total - 100).toFixed(1)}%)`}
          </span>
        </div>
      )}

      <div className="add-form">
        <input
          className="input sym-input"
          type="text"
          placeholder="Symbol"
          value={symbol}
          maxLength={8}
          onChange={e => { setSymbol(e.target.value.toUpperCase()); setAddError(null); }}
          onKeyDown={e => {
            if (e.key === 'Enter') allocInputRef.current?.focus();
          }}
        />
        <input
          ref={allocInputRef}
          className="input pct-input"
          type="number"
          placeholder="%"
          value={pct}
          min={0.01}
          max={100}
          step={0.5}
          onChange={e => { setPct(e.target.value); setAddError(null); }}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
        />
        <button className="btn btn-secondary" onClick={handleAdd}>
          Add
        </button>
      </div>

      {addError && <div className="field-error">{addError}</div>}

      <button
        className={`btn btn-primary save-btn status-${saveStatus}`}
        onClick={handleSave}
        disabled={!isExact100 || saveStatus === 'saving'}
      >
        {saveStatus === 'saving' ? <><LoadingSpinner size={15} /> Saving…</> : saveLabel}
      </button>

      {!isExact100 && allocations.length > 0 && (
        <div className="hint-msg">
          {total < 100
            ? `Add ${(100 - total).toFixed(1)}% more to reach 100%`
            : `Remove ${(total - 100).toFixed(1)}% to reach 100%`}
        </div>
      )}
    </div>
  );
}
