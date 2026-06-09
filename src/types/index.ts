export interface Allocation {
  id?: string;
  symbol: string;
  allocation: number;
}

export interface SipResult {
  symbol: string;
  allocation: number;
  price: number | null;
  allocationAmount: number;
  sharesToBuy: number | null;
  investedAmount: number | null;
  remainingCash: number | null;
  isCash: boolean;
  error?: string;
}

export interface SipCalculation {
  results: SipResult[];
  summary: PortfolioSummary;
  calculatedAt: Date;
}

export interface PortfolioSummary {
  sipAmount: number;
  totalInvested: number;
  totalCashAllocation: number;
  totalUnallocatedCash: number;
}

export interface UserPreferences {
  lastSipAmount?: number;
  // TODO: theme, currency format, notification prefs
}
