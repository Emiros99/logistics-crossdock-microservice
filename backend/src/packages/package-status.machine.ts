import { PackageStatus } from '@prisma/client';

/**
 * A csomag-státusz irányított gráfja (state machine).
 * Pure, mellékhatás-mentes -> önmagában egységtesztelhető, a service-től független (SRP).
 *
 *   CREATED -> RECEIVED_AT_CROSSDOCK -> SORTED -> DISPATCHED -> (nincs tovább)
 *
 * A `null` érték jelöli a végállapotot (DISPATCHED): innen nincs megengedett átmenet.
 */
const TRANSITIONS: Readonly<Record<PackageStatus, PackageStatus | null>> = {
  [PackageStatus.CREATED]: PackageStatus.RECEIVED_AT_CROSSDOCK,
  [PackageStatus.RECEIVED_AT_CROSSDOCK]: PackageStatus.SORTED,
  [PackageStatus.SORTED]: PackageStatus.DISPATCHED,
  [PackageStatus.DISPATCHED]: null,
};

export class PackageStatusMachine {
  /** true, ha a csomag már a végállapotban van (nem léptethető tovább). */
  static isTerminal(status: PackageStatus): boolean {
    return TRANSITIONS[status] === null;
  }

  /**
   * A következő megengedett állapot, vagy null ha nincs (végállapot).
   * A service ezt a tranzakción belül hívja; null -> 409 Conflict + rollback.
   */
  static next(current: PackageStatus): PackageStatus | null {
    return TRANSITIONS[current];
  }
}
