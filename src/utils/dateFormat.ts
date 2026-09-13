const usShortDateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** Formats dates for display as "Oct 13, 2025" without shifting ISO date-only values. */
export function formatUsDate(value: string | Date): string {
  if (typeof value === 'string') {
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (isoDate) {
      const [, year, month, day] = isoDate;
      return usShortDateFormatter.format(
        new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))),
      );
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : usShortDateFormatter.format(date);
}
