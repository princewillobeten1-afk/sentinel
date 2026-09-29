import { describe, expect, it } from 'vitest';
import { GET as creator } from '@/app/api/v1/analytics/creator/[creatorAddress]/route';

describe('unsupported analytics', () => {
  it('does not return fabricated creator launch history', async () => {
    const response = await creator();
    const body = await response.json();
    expect(response.status).toBe(501);
    expect(body.error.code).toBe('ANALYSIS_NOT_MEASURED');
    expect(JSON.stringify(body)).not.toContain('MintAlpha111');
  });
});
