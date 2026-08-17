export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { ReputationEvidenceEngine } from '@/lib/trust/evidence';

const engine = new ReputationEvidenceEngine();

export async function GET(
  request: Request,
  { params }: { params: { entityType: string, entityId: string } }
) {
  try {
    // In a real app, we'd paginate here using searchParams
    const evidence = await engine.fetchEvidenceLog(params.entityId);
    return NextResponse.json({ evidence });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
