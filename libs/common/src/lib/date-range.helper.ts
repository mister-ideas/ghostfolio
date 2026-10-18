import { DateRange } from '@ghostfolio/common/types';

import { differenceInYears } from 'date-fns';

/**
 * Returns the date ranges which are meaningful for a user depending on the
 * date of the first activity (e.g. `1y` requires at least one year of data).
 */
export function getAvailableDateRanges({
  dateOfFirstActivity,
  referenceDate = new Date()
}: {
  dateOfFirstActivity?: Date | string | null;
  referenceDate?: Date;
} = {}): DateRange[] {
  const yearsOfData = dateOfFirstActivity
    ? differenceInYears(referenceDate, new Date(dateOfFirstActivity))
    : 0;

  const dateRanges: DateRange[] = ['1d', 'wtd', 'mtd', 'ytd'];

  if (yearsOfData >= 1) {
    dateRanges.push('1y');
  }

  if (yearsOfData >= 5) {
    dateRanges.push('5y');
  }

  dateRanges.push('max');

  return dateRanges;
}
