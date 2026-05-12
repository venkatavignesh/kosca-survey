import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/api';
import { buildWorkbook, getCampaignWithResponses } from '@/lib/responses';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const data = await getCampaignWithResponses(id, {
    locationIds: sp.getAll('locationId'),
    officeTypeIds: sp.getAll('officeTypeId'),
    departmentIds: sp.getAll('departmentId'),
  });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const xlsx = await buildWorkbook(data);
  const safeTitle = data.campaign.title.replace(/[^a-z0-9_-]+/gi, '_');
  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeTitle}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
