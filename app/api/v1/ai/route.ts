import { errorResponse, jsonResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requirePilotUser, pilotConfig } from '@/lib/ai/pilot/config';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  try {
    await requirePilotUser(req);
    const ready=pilotConfig().success && !!process.env.DATABASE_URL && !!process.env.REDIS_URL;
    return jsonResponse({status:ready?'configured':'setup_required',publicDataOnly:true,executionEnabled:false,retentionDays:30},200,{'Cache-Control':'private, no-store'});
  }catch(e){return errorResponse(e instanceof ApiError ? e : new ApiError('Copilot status is unavailable.',503,'AI_UNAVAILABLE'));}
}
