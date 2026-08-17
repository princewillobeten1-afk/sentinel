export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { ReputationEngine } from '@/lib/trust/reputation';
import { EntityType } from '@/lib/trust/types';

const engine = new ReputationEngine();

export async function GET(
  request: Request,
  { params }: { params: { entityType: string, entityId: string } }
) {
  try {
    const type = params.entityType.toUpperCase() as EntityType;
    if (!Object.values(EntityType).includes(type)) {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    const profile = await engine.getProfile(type, params.entityId);
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
