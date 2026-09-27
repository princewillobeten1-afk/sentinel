import { errorResponse, jsonResponse } from '@/lib/server/api';
import { requirePilotUser } from '@/lib/ai/pilot/config';
import { skills } from '@/lib/ai/pilot/skills';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  try { await requirePilotUser(req); return jsonResponse({skills:Object.entries(skills).map(([id,s])=>({id,version:s.version,description:s.description})),executionEnabled:false},200,{'Cache-Control':'private, no-store'}); }
  catch(e){return errorResponse(e instanceof Error?e:new Error('Unavailable'));}
}
