import { errorResponse, jsonResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requirePilotUser } from '@/lib/ai/pilot/config';
import { listSessions } from '@/lib/ai/pilot/repository';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  try {const user=await requirePilotUser(req);return jsonResponse({sessions:await listSessions(user.userId)},200,{'Cache-Control':'private, no-store'});}
  catch(e){return errorResponse(e instanceof ApiError ? e : new ApiError('Conversations are temporarily unavailable.',503,'AI_STORAGE_UNAVAILABLE'));}
}
