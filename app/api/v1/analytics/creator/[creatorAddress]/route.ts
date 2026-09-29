import { NextResponse } from 'next/server';

/** Retired: the former creator launch history was synthetic. */
export async function GET() {
  return NextResponse.json({ error: { code: 'ANALYSIS_NOT_MEASURED',
    message: 'Creator outcomes are unavailable until verified lifecycle history can be queried.' } }, { status: 501 });
}
