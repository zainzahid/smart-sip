import { useState } from 'react';
import type { Allocation, SipCalculation } from '../types';
import { fetchAllPrices } from '../services/priceService';
import { calculateSip } from '../services/sipCalculator';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  allocations: Allocation[];
  initialAmount?: number;
  onAmountChange?: (amount: number) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);

export function SipSection({ allocations, initialAmount, onAmountChange }: Props) {
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '');
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [result, setResult] = useState<SipCalculation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = allocations.reduce((s, a) => s + a.allocation, 0);
  const isAllocOk = Math.abs(total - 100) < 0.001;
  const sipAmount = parseFloat(amount.replace(/,/g, ''));
  const isAmountOk = !isNaN(sipAmount) && sipAmount > 0;
  const canCalculate = isAmountOk && isAllocOk && allocations.length > 0;

  async function handleCalculate() {
    if (!canCalculate) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const stocks = allocations.filter(a => a.symbol !== 'CASH').map(a => a.symbol);
    setLoadMsg(
      stocks.length
        ? `Fetching prices: ${stocks.join(' · ')}…`
        : 'Calculating…',
    );

    try {
      const prices = await fetchAllPrices(stocks);
      setResult(calculateSip(allocations, sipAmount, prices));
      onAmountChange?.(sipAmount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed');
    } finally {
      setLoading(false);
      setLoadMsg('');
    }
  }

  return (
    <div className="sip-section">
      {/* Calculator card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Monthly SIP</h2>
          {result && (
            <span className="calc-time">
              as of {result.calculatedAt.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="sip-row">
          <div className="input-wrap">
            <span className="input-prefix">PKR</span>
            <input
              className="input sip-input"
              type="text"
              inputMode="numeric"
              placeholder="40,000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCalculate(); }}
            />
          </div>
          <button
            className="btn btn-primary calc-btn"
            onClick={handleCalculate}
            disabled={!canCalculate || loading}
          >
            {loading ? <LoadingSpinner size={18} /> : 'Calculate'}
          </button>
        </div>

        {!isAllocOk && allocations.length > 0 && (
          <div className="warn-msg">Allocations must total 100% to calculate.</div>
        )}
        {allocations.length === 0 && (
          <div className="warn-msg">Add portfolio allocations first.</div>
        )}
        {loading && loadMsg && <div className="info-msg">{loadMsg}</div>}
        {error && <div className="error-msg">{error}</div>}
      </div>

      {/* Results */}
      {result && (
        <>
          <div className="summary-grid">
            <SummaryCard label="SIP Amount" value={`PKR ${fmt(result.summary.sipAmount)}`} variant="accent" />
            <SummaryCard label="Total Invested" value={`PKR ${fmt(result.summary.totalInvested)}`} variant="success" />
            <SummaryCard label="Cash Reserve" value={`PKR ${fmt(result.summary.totalCashAllocation)}`} variant="neutral" />
            <SummaryCard
              label="Unallocated Cash"
              value={`PKR ${fmt(result.summary.totalUnallocatedCash)}`}
              variant={result.summary.totalUnallocatedCash > 0 ? 'warning' : 'neutral'}
            />
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Purchase Recommendations</h2>
            </div>
            <div className="table-scroll">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="r">Alloc %</th>
                    <th className="r">Price</th>
                    <th className="r">Alloc Amt</th>
                    <th className="r">Shares</th>
                    <th className="r">Invested</th>
                    <th className="r">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map(row => (
                    <tr key={row.symbol} className={row.error ? 'row-err' : ''}>
                      <td>
                        <span className={`sym-badge ${row.isCash ? 'cash' : ''}`}>
                          {row.symbol}
                        </span>
                      </td>
                      <td className="r">{row.allocation}%</td>
                      <td className="r">
                        {row.isCash ? '—' : row.price != null
                          ? fmt(row.price)
                          : <span className="err-cell" title={row.error}>⚠ Error</span>
                        }
                      </td>
                      <td className="r">{fmt(row.allocationAmount)}</td>
                      <td className="r">
                        {row.isCash ? '—' : row.sharesToBuy != null ? row.sharesToBuy : '—'}
                      </td>
                      <td className="r">
                        {row.investedAmount != null ? fmt(row.investedAmount) : '—'}
                      </td>
                      <td className="r">
                        {row.remainingCash != null ? fmt(row.remainingCash) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  variant: 'accent' | 'success' | 'warning' | 'neutral';
}

function SummaryCard({ label, value, variant }: SummaryCardProps) {
  return (
    <div className={`summary-card v-${variant}`}>
      <span className="s-label">{label}</span>
      <span className="s-value">{value}</span>
    </div>
  );
}
