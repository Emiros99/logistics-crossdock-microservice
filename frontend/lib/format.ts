/**
 * Megjelenítési segédfüggvények. A dátumformázó lokalizált (hu-HU) és
 * hibatűrő: érvénytelen időbélyegnél a nyers stringet adja vissza összeomlás
 * helyett (peremeset-kezelés).
 */

const dateTimeFormatter = new Intl.DateTimeFormat('hu-HU', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** ISO 8601 időbélyeg → olvasható hu-HU dátum-idő. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return dateTimeFormatter.format(date);
}
