import { HistoricalDataItem } from '../historical-data-item.interface';
import { PortfolioPerformance } from '../portfolio-performance.interface';
import { ResponseError } from './errors.interface';

export interface PortfolioPerformanceResponse extends ResponseError {
  chart?: HistoricalDataItem[];
  dateOfFirstActivity: Date;

  /** Whether a market (including the pre-market and the post-market) of a holding is open */
  isMarketOpen?: boolean;

  performance: PortfolioPerformance;
}
