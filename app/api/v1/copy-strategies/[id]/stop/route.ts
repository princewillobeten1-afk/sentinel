export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Stub for kill switch
  console.log(`Kill switch activated for strategy ${params.id}`);
  
  return NextResponse.json({
    id: params.id,
    status: 'STOPPED',
    message: 'Copying stopped immediately.'
  });
}
