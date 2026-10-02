import { requireAuth } from '@/lib/session';
import { successResponse, errorResponse } from '@/lib/responses';
import { generateMonthlyReport } from '@/services/monthly-nutrition.service';

export async function GET() {
  try {
    const userId = await requireAuth();
    const report = await generateMonthlyReport(userId);
    return successResponse(report);
  } catch (error: any) {
    if (error.statusCode) return errorResponse(error.message, error.statusCode, error.code);
    return errorResponse('Error al generar reporte mensual', 500);
  }
}
