export interface OrderReservation {
  id: string;
  orderId: string;
  walletAddress: string;
  token: string;
  amount: number;
  status: 'ACTIVE' | 'RELEASED' | 'CONSUMED';
}

/**
 * ReservationManager handles virtual balances to prevent double-selling.
 * Example: User has 10,000 TOKEN. They create a Stop Loss for 5,000.
 * If they try to create another for 7,000, it should be rejected.
 */
export class ReservationManager {
  private reservations: Map<string, OrderReservation[]> = new Map(); // Key: walletAddress_token

  private getKey(walletAddress: string, token: string): string {
    return `${walletAddress}_${token}`;
  }

  /**
   * Get the total reserved balance for a wallet's token
   */
  public getReservedBalance(walletAddress: string, token: string): number {
    const key = this.getKey(walletAddress, token);
    const active = (this.reservations.get(key) || []).filter(r => r.status === 'ACTIVE');
    return active.reduce((sum, r) => sum + r.amount, 0);
  }

  /**
   * Attempt to create a reservation. Returns true if successful.
   */
  public reserve(orderId: string, walletAddress: string, token: string, amount: number, totalBalance: number): boolean {
    const currentlyReserved = this.getReservedBalance(walletAddress, token);
    const available = totalBalance - currentlyReserved;

    if (amount > available) {
      console.warn(`[ReservationManager] Cannot reserve ${amount} ${token}. Only ${available} available.`);
      return false;
    }

    const reservation: OrderReservation = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      orderId,
      walletAddress,
      token,
      amount,
      status: 'ACTIVE'
    };

    const key = this.getKey(walletAddress, token);
    const existing = this.reservations.get(key) || [];
    this.reservations.set(key, [...existing, reservation]);
    
    return true;
  }

  /**
   * Release a reservation (e.g. order cancelled)
   */
  public release(orderId: string) {
    this.updateStatus(orderId, 'RELEASED');
  }

  /**
   * Consume a reservation (e.g. order executed)
   */
  public consume(orderId: string) {
    this.updateStatus(orderId, 'CONSUMED');
  }

  private updateStatus(orderId: string, status: 'RELEASED' | 'CONSUMED') {
    for (const [key, reservations] of this.reservations.entries()) {
      const reservation = reservations.find(r => r.orderId === orderId);
      if (reservation) {
        reservation.status = status;
        break; // Assuming 1 reservation per order for now
      }
    }
  }
}

export const globalReservationManager = new ReservationManager();
