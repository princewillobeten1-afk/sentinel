import { errorResponse, jsonResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requirePilotUser, pilotSetupIssues } from '@/lib/ai/pilot/config';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  try {
    await requirePilotUser(req);
    const setupIssues = pilotSetupIssues();
    return jsonResponse({status:setupIssues.length===0?'configured':'setup_required',setupIssues,publicDataOnly:true,executionEnabled:false,retentionDays:30},200,{'Cache-Control':'private, no-store'});
  }catch(e){return errorResponse(e instanceof ApiError ? e : new ApiError('Copilot status is unavailable.',503,'AI_UNAVAILABLE'));}
}
