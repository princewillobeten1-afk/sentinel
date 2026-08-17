export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Fetch user's alert rules
  return NextResponse.json({
    rules: [
      {
        id: '1',
        name: 'Liquidity Collapse',
        category: 'LIQUIDITY',
        conditions: {
          operator: 'AND',
          conditions: [
            { field: 'liquidityDropPct', operator: 'GT', value: 50 }
          ]
        },
        severity: 'CRITICAL',
        channels: ['IN_APP', 'PUSH']
      }
    ]
  });
}

export async function POST(request: Request) {
  // Create a new AlertRule
  const body = await request.json();
  
  // Real implementation: INSERT INTO alert_rules ...
  console.log('Created alert rule:', body);
  
  return NextResponse.json({ success: true, ruleId: 'new-rule-id' });
}
