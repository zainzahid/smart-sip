import type { Allocation, SipCalculation, SipResult } from '../types';

const CASH_SYMBOL = 'CASH';

export function calculateSip(
  allocations: Allocation[],
  sipAmount: number,
  prices: Map<string, { price?: number; error?: string }>,
): SipCalculation {
  const results: SipResult[] = allocations.map(alloc => {
    const allocationAmount = (alloc.allocation / 100) * sipAmount;

    if (alloc.symbol === CASH_SYMBOL) {
      return {
        symbol: CASH_SYMBOL,
        allocation: alloc.allocation,
        price: null,
        allocationAmount,
        sharesToBuy: null,
        investedAmount: allocationAmount,
        remainingCash: 0,
        isCash: true,
      };
    }

    const priceData = prices.get(alloc.symbol);

    if (!priceData?.price) {
      return {
        symbol: alloc.symbol,
        allocation: alloc.allocation,
        price: null,
        allocationAmount,
        sharesToBuy: null,
        investedAmount: null,
        remainingCash: null,
        isCash: false,
        error: priceData?.error ?? 'Price unavailable',
      };
    }

    const { price } = priceData;
    const sharesToBuy = Math.floor(allocationAmount / price);
    const investedAmount = sharesToBuy * price;
    const remainingCash = allocationAmount - investedAmount;

    return {
      symbol: alloc.symbol,
      allocation: alloc.allocation,
      price,
      allocationAmount,
      sharesToBuy,
      investedAmount,
      remainingCash,
      isCash: false,
    };
  });

  const stockResults = results.filter(r => !r.isCash);
  const cashResult = results.find(r => r.isCash);

  const totalInvested = stockResults.reduce(
    (sum, r) => sum + (r.investedAmount ?? 0),
    0,
  );
  const totalCashAllocation = cashResult?.allocationAmount ?? 0;
  const totalUnallocatedCash = stockResults.reduce(
    (sum, r) => sum + (r.remainingCash ?? 0),
    0,
  );

  return {
    results,
    summary: {
      sipAmount,
      totalInvested,
      totalCashAllocation,
      totalUnallocatedCash,
    },
    calculatedAt: new Date(),
  };
}
