/**
 * A Solana signature identifies a transaction, not necessarily one trade.
 * Current balance-delta feeds produce one aggregate per mint and direction;
 * decoders that can prove an instruction position may identify individual fills.
 * Provider names must never be part of this key.
 */
export interface ChainEventIdentity {
  signature: string;
  mint: string;
  kind: string;
  instructionIndex?: number;
  innerInstructionIndex?: number;
}

export function chainEventId(event: ChainEventIdentity): string | null {
  const { signature, mint, kind, instructionIndex, innerInstructionIndex } = event;
  if (!signature || !mint || !kind) return null;
  if (instructionIndex !== undefined && (!Number.isSafeInteger(instructionIndex) || instructionIndex < 0)) return null;
  if (innerInstructionIndex !== undefined && (instructionIndex === undefined
    || !Number.isSafeInteger(innerInstructionIndex) || innerInstructionIndex < 0)) return null;
  const position = instructionIndex === undefined ? 'aggregate'
    : innerInstructionIndex === undefined ? `outer-${instructionIndex}`
      : `inner-${instructionIndex}-${innerInstructionIndex}`;
  return `solana:${signature}:${mint}:${kind}:${position}`;
}
