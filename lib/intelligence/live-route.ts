import 'server-only';
import { withApiGateway } from '@/lib/server/api-gateway';
import { jsonResponse } from '@/lib/server/api';
import { getLiveIntelligence, getIntelligenceHistory, validateIntelligenceToken } from './live-service';

export type IntelligenceSection = 'report' | 'signals' | 'history' | 'timeline' | 'market' | 'liquidity' | 'contract' | 'activity' | 'organic' | 'insiders';
export function intelligenceRoute(section: IntelligenceSection) {
  return withApiGateway(async (_ctx, _request, { chain, token }) => {
    validateIntelligenceToken(chain, token);
    if (section === 'history' || section === 'timeline') return jsonResponse({ schemaVersion: '2', mint: token, ...await getIntelligenceHistory(chain, token) }, 200, { 'Cache-Control': 'no-store' });
    const report = await getLiveIntelligence(chain, token);
    if (section === 'report') return jsonResponse(report, 200, { 'Cache-Control': 'no-store' });
    const selected = report.metrics.filter(m => section === 'market' ? m.category === 'market'
      : section === 'liquidity' ? ['liquidity', 'lpLocked'].includes(m.id)
      : section === 'contract' ? m.category === 'security'
      : section === 'activity' ? m.id === 'volume24h'
      : section === 'insiders' ? ['insiders', 'snipers', 'bundlers'].includes(m.id) : false);
    return jsonResponse({ schemaVersion: '2', token: report.token, generatedAt: report.generatedAt, metrics: selected,
      findings: section === 'signals' ? report.findings : report.findings.filter(f => f.evidenceIds.some(id => selected.some(m => m.id === id))),
      limitations: report.limitations,
      ...(section === 'organic' ? { status: 'unavailable', reason: 'No verified organic-activity assessment is available. Aggregate volume does not establish organic activity.' } : {}),
    }, 200, { 'Cache-Control': 'no-store' });
  }, { scopes: ['READ_TOKEN_INTELLIGENCE'], optionalAuth: true });
}
