export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { TrustGraphEngine } from '@/lib/trust/graph';
import { EntityType } from '@/lib/trust/types';

const engine = new TrustGraphEngine();

export async function GET(
  request: Request,
  { params }: { params: { entityType: string, entityId: string } }
) {
  try {
    const type = params.entityType.toUpperCase() as EntityType;
    if (!Object.values(EntityType).includes(type)) {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    const graph = await engine.getEntityGraph(type, params.entityId);
    return NextResponse.json(graph);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
