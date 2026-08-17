import type { AmmKind, PoolState } from '../types';
import type { AmmAdapter } from './types';
import { constantProductAdapter } from './constant-product';
import { concentratedAdapter } from './concentrated';

export * from './types';
export { constantProductAdapter } from './constant-product';
export { concentratedAdapter } from './concentrated';

/**
 * Adapter registry. Stable and weighted pools currently fall back to the
 * constant-product adapter until dedicated math is added — the interface is
 * ready for them (spec §10).
 */
const REGISTRY: Record<AmmKind, AmmAdapter> = {
  CONSTANT_PRODUCT: constantProductAdapter,
  CONCENTRATED_LIQUIDITY: concentratedAdapter,
  STABLE: constantProductAdapter,
  WEIGHTED: constantProductAdapter,
};

export function getAmmAdapter(kind: AmmKind): AmmAdapter {
  return REGISTRY[kind] ?? constantProductAdapter;
}

export function adapterForPool(pool: PoolState): AmmAdapter {
  return getAmmAdapter(pool.kind);
}
