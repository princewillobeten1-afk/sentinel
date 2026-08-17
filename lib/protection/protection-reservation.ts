export interface InventoryReservation {
  id: string;
  positionId: string;
  tokenAmount: number;
  status: 'ACTIVE' | 'RELEASED' | 'CONSUMED';
  createdAt: string;
}

const inventoryReservationStore = new Map<string, InventoryReservation>();

export class ProtectionReservationManager {
  public getReservedTokens(positionId: string): number {
    let total = 0;
    for (const res of inventoryReservationStore.values()) {
      if (res.positionId === positionId && res.status === 'ACTIVE') {
        total += res.tokenAmount;
      }
    }
    return total;
  }

  public reserveInventory(positionId: string, requestedAmount: number, totalPositionTokens: number): {
    success: boolean;
    reservation?: InventoryReservation;
    error?: string;
  } {
    const reserved = this.getReservedTokens(positionId);
    const available = totalPositionTokens - reserved;

    if (requestedAmount > available) {
      return {
        success: false,
        error: `Cannot reserve ${requestedAmount} tokens for position exit. Only ${available} available (Reserved: ${reserved}).`
      };
    }

    const reservation: InventoryReservation = {
      id: `inv_${Math.random().toString(36).substring(2, 10)}`,
      positionId,
      tokenAmount: requestedAmount,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    inventoryReservationStore.set(reservation.id, reservation);
    return { success: true, reservation };
  }

  public release(reservationId: string): void {
    const res = inventoryReservationStore.get(reservationId);
    if (res) res.status = 'RELEASED';
  }

  public consume(reservationId: string): void {
    const res = inventoryReservationStore.get(reservationId);
    if (res) res.status = 'CONSUMED';
  }
}

export const protectionReservationManager = new ProtectionReservationManager();
