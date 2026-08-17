import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { adminConfigService } from '@/lib/admin/config';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/config — list all configuration settings and active risk overrides. */
export async function GET() {
  try {
    const settings = adminConfigService.getAllSettings();
    const riskOverrides = adminConfigService.listRiskOverrides();
    return jsonResponse({ settings, riskOverrides });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load configuration settings', 500));
  }
}

/** POST /api/v1/admin/config — update setting, rollback version, or grant temporary risk override. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, key, value, targetVersion, override, updatedBy = 'admin_duty', updatedByRole = 'SUPER_ADMIN', reason = 'Config update' } = body;

    if (action === 'UPDATE' && key) {
      const setting = adminConfigService.updateSetting(key, value, {
        updatedBy,
        updatedByRole,
        reason,
      });
      return jsonResponse({ setting });
    }

    if (action === 'ROLLBACK' && key && targetVersion) {
      const setting = adminConfigService.rollbackSetting(key, targetVersion, {
        updatedBy,
        updatedByRole,
        reason: reason || `Rollback to version ${targetVersion}`,
      });
      return jsonResponse({ setting });
    }

    if (action === 'CREATE_OVERRIDE' && override) {
      const newOverride = adminConfigService.createRiskOverride({
        entityType: override.entityType,
        entityId: override.entityId,
        overrideRules: override.overrideRules,
        adminId: updatedBy,
        adminRole: updatedByRole,
        reason: reason || 'Temporary manual risk bypass',
        durationHours: override.durationHours || 24,
      });
      return jsonResponse({ override: newOverride });
    }

    throw new ApiError('Invalid config action', 400);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to update configuration', 500));
  }
}
