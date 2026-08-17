export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Stub for getting user's notification preferences
  return NextResponse.json({
    channelPreferences: {
      MARKET: ['IN_APP', 'PUSH'],
      RISK: ['IN_APP', 'PUSH', 'EMAIL'],
      PORTFOLIO: ['IN_APP']
    },
    quietHoursStart: '23:00',
    quietHoursEnd: '07:00',
    quietHoursTimezone: 'UTC',
    overrideCritical: true
  });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  // Update preferences
  return NextResponse.json({ success: true, updated: body });
}
