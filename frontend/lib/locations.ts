/**
 * Előre definiált raktári szkennelési helyszínek.
 * PoC-ban statikus lista; éles rendszerben a backend telephely-regiszteréből
 * töltődne. A `readonly` tömb garantálja az immutabilitást.
 */
export const WAREHOUSE_LOCATIONS = [
  'BUD-HUB-01 / Kapu 4',
  'BUD-HUB-01 / Kapu 7',
  'BUD-HUB-01 / Szortírozó A',
  'BUD-HUB-02 / Bejövő rámpa',
  'DEB-HUB-01 / Kapu 2',
  'GYOR-DEPO / Kimenő járat',
] as const;

export type WarehouseLocation = (typeof WAREHOUSE_LOCATIONS)[number];
