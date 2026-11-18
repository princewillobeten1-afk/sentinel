import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { ApiError } from '@/lib/server/errors';
import { isEvmAddress } from '@/lib/chains/chain-config';
import { robinhoodRpcCall } from '@/lib/blockchain/robinhood-rpc';
import { readRobinhoodAllowances } from '@/lib/blockchain/robinhood-rpc-protocols';

export const dynamic = 'force-dynamic';

const allowanceSchema = z.object({
  owner: z.string().refine(isEvmAddress, 'Invalid owner EVM address'),
  tokenAddress: z.string().refine(isEvmAddress, 'Invalid token EVM address'),
  spender: z.string().refine(isEvmAddress, 'Invalid spender EVM address'),
  checkPermit2: z.boolean().optional().default(false),
});

function toAllowanceApiError(error: unknown, fallbackCode: string): Error {
  if (error instanceof ApiError) return error;
  const msg = error instanceof Error ? error.message : String(error);
  if (/HTTP 429|HTTP 5\d\d|TimeoutError|timed out|aborted/i.test(msg)) {
    return new ApiError(
      'Robinhood RPC is temporarily busy; please retry shortly.',
      503,
      'UPSTREAM_RPC_UNAVAILABLE',
    );
  }
  return error instanceof Error ? error : new ApiError(msg, 500, fallbackCode);
}

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const data = validateSchema(allowanceSchema, payload);
    const status = await readRobinhoodAllowances(data);

    return jsonResponse({
      erc20Allowance: status.erc20Allowance.toString(),
      permit2Amount: status.permit2Amount.toString(),
      permit2Expiration: status.permit2Expiration,
    });
  } catch (error) {
    return errorResponse(toAllowanceApiError(error, 'EVM_ALLOWANCE_ERROR'));
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const txHash = (searchParams.get('txHash') || '').trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      throw new ApiError('Invalid EVM transaction hash.', 400, 'INVALID_TX_HASH');
    }

    const receipt = await robinhoodRpcCall<{
      status?: string;
      blockNumber?: string;
      gasUsed?: string;
    } | null>('eth_getTransactionReceipt', [txHash]);

    if (!receipt) {
      return jsonResponse({
        txHash,
        status: 'pending' as const,
      });
    }

    const succeeded = receipt.status === '0x1';
    return jsonResponse({
      txHash,
      status: succeeded ? ('confirmed' as const) : ('failed' as const),
      blockNumber: receipt.blockNumber ? Number.parseInt(receipt.blockNumber, 16) : undefined,
      gasUsed: receipt.gasUsed ? BigInt(receipt.gasUsed).toString() : undefined,
    });
  } catch (error) {
    return errorResponse(toAllowanceApiError(error, 'EVM_TX_STATUS_ERROR'));
  }
}
