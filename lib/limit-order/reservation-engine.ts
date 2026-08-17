import { LimitOrderReservation } from './types';

// In-memory store for active reservations
const reservationStore = new Map<string, LimitOrderReservation>(); // id -> reservation

export class LimitOrderReservationEngine {
  public getReservedBalance(walletId: string, token: string): number {
    let total = 0;
    for (const res of reservationStore.values()) {
      if (res.walletId === walletId && res.token === token && res.status === 'ACTIVE') {
        total += res.amount;
      }
    }
    return total;
  }

  public reserve(params: {
    limitOrderId: string;
    walletId: string;
    token: string;
    amount: number;
    walletActualBalance: number;
  }): { success: boolean; reservation?: LimitOrderReservation; error?: string } {
    const currentlyReserved = this.getReservedBalance(params.walletId, params.token);
    const availableBalance = params.walletActualBalance - currentlyReserved;

    if (params.amount > availableBalance) {
      return {
        success: false,
        error: `Insufficient available balance. Required: ${params.amount} ${params.token}, Available: ${availableBalance.toFixed(4)} ${params.token} (Reserved: ${currentlyReserved.toFixed(4)})`
      };
    }

    const reservation: LimitOrderReservation = {
      id: `res_${Math.random().toString(36).substring(2, 10)}`,
      limitOrderId: params.limitOrderId,
      walletId: params.walletId,
      token: params.token,
      amount: params.amount,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    reservationStore.set(reservation.id, reservation);

    return { success: true, reservation };
  }

  public release(limitOrderId: string): void {
    for (const res of reservationStore.values()) {
      if (res.limitOrderId === limitOrderId && res.status === 'ACTIVE') {
        res.status = 'RELEASED';
      }
    }
  }

  public consume(limitOrderId: string): void {
    for (const res of reservationStore.values()) {
      if (res.limitOrderId === limitOrderId && res.status === 'ACTIVE') {
        res.status = 'CONSUMED';
      }
    }
  }

  public checkExternalConflict(params: {
    walletId: string;
    token: string;
    walletActualBalance: number;
  }): { hasConflict: boolean; activeReservations: LimitOrderReservation[] } {
    const active: LimitOrderReservation[] = [];
    let totalReserved = 0;

    for (const res of reservationStore.values()) {
      if (res.walletId === params.walletId && res.token === params.token && res.status === 'ACTIVE') {
        active.push(res);
        totalReserved += res.amount;
      }
    }

    return {
      hasConflict: totalReserved > params.walletActualBalance,
      activeReservations: active
    };
  }
}

export const limitOrderReservationEngine = new LimitOrderReservationEngine();
