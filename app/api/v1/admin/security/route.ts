import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { adminIncidentService } from '@/lib/admin/incidents';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/security — list security incidents, abuse reports, and active threat indicators. */
export async function GET() {
  try {
    const incidents = adminIncidentService.listIncidents();
    const abuseReports = adminIncidentService.listAbuseReports();

    return jsonResponse({
      incidents,
      abuseReports,
      threatAnomalies: [
        { type: 'FAILED_AUTH_CLUSTER', ip: '185.220.101.5', count: 142, status: 'BLOCKED' },
        { type: 'API_ABUSE_BURST', keyId: 'key_anon_99', rps: 450, status: 'THROTTLED' },
      ],
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load security center telemetry', 500));
  }
}

/** POST /api/v1/admin/security — create/update incident, resolve abuse report, or apply user restriction. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, incidentId, status, note, restriction, abuseResolution, updatedBy = 'admin_security', updatedByRole = 'COMPLIANCE' } = body;

    if (action === 'UPDATE_INCIDENT_STATUS' && incidentId && status) {
      const incident = adminIncidentService.updateIncidentStatus({
        incidentId,
        status,
        updatedBy,
        updatedByRole,
        note: note || `Status transitioned to ${status}`,
      });
      return jsonResponse({ incident });
    }

    if (action === 'APPLY_USER_RESTRICTION' && restriction) {
      const record = adminIncidentService.applyUserRestriction({
        userId: restriction.userId,
        action: restriction.action,
        reason: restriction.reason || 'Compliance restriction applied',
        appliedBy: updatedBy,
        appliedByRole: updatedByRole,
        durationHours: restriction.durationHours,
      });
      return jsonResponse({ restriction: record });
    }

    if (action === 'RESOLVE_ABUSE_REPORT' && abuseResolution) {
      const report = adminIncidentService.resolveAbuseReport({
        reportId: abuseResolution.reportId,
        status: abuseResolution.status,
        resolution: abuseResolution.resolution,
        reviewedBy: updatedBy,
        reviewedByRole: updatedByRole,
      });
      return jsonResponse({ report });
    }

    throw new ApiError('Invalid security action', 400);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to perform security operation', 500));
  }
}
