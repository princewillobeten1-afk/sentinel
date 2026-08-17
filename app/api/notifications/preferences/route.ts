export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Fetch user's notification preferences
  return NextResponse.json({
    preferences: {
      channels: {
        IN_APP: true,
        PUSH: true,
        EMAIL: false,
        TELEGRAM: true
      },
      quietHoursStart: '23:00',
      quietHoursEnd: '07:00',
      quietHoursTimezone: 'America/New_York',
      overrideCritical: true
    }
  });
}

export async function PATCH(request: Request) {
  // Update notification preferences
  const body = await request.json();
  
  // Real implementation: UPDATE alert_preferences ...
  console.log('Updated alert preferences:', body);
  
  return NextResponse.json({ success: true });
}
