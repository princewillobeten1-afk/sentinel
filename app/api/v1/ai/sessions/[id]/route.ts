import { z } from 'zod';
import { errorResponse, jsonResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requirePilotUser } from '@/lib/ai/pilot/config';
import { getTurns, deleteSession } from '@/lib/ai/pilot/repository';
export const dynamic='force-dynamic';
async function handle(req:Request,id:string,remove=false) {
  try {
    const user=await requirePilotUser(req);
    if(!z.string().uuid().safeParse(id).success) throw new ApiError('Invalid conversation.',400,'AI_INVALID_REQUEST');
    if(remove){await deleteSession(user.userId,id);return jsonResponse({deleted:true},200,{'Cache-Control':'private, no-store'});}
    return jsonResponse({turns:await getTurns(user.userId,id)},200,{'Cache-Control':'private, no-store'});
  }catch(e){return errorResponse(e instanceof ApiError ? e : new ApiError('Conversation storage is unavailable.',503,'AI_STORAGE_UNAVAILABLE'));}
}
export async function GET(req:Request,{params}:{params:{id:string}}){return handle(req,params.id);}
export async function DELETE(req:Request,{params}:{params:{id:string}}){return handle(req,params.id,true);}
