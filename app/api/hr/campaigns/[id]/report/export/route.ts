import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/api';
import { getQuestionReport, buildReportWorkbook } from '@/lib/reports';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;

  const questionId = sp.get('questionId') || undefined;
  const selectedOptions = sp.getAll('option');
  const textQuery = sp.get('text') || undefined;
  const q = sp.get('q') || undefined;
  const locationIds = sp.getAll('locationId');
  const officeTypeIds = sp.getAll('officeTypeId');
  const departmentIds = sp.getAll('departmentId');

  const report = await getQuestionReport(id, {
    questionId, selectedOptions: selectedOptions.length ? selectedOptions : undefined,
    textQuery, q, locationIds, officeTypeIds, departmentIds,
  });
  if (!report) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!report.question) return NextResponse.json({ error: 'questionId required' }, { status: 400 });

  const summaryParts: string[] = [];
  if (selectedOptions.length) summaryParts.push(`Selected: ${selectedOptions.join(', ')}`);
  if (textQuery) summaryParts.push(`Text: “${textQuery}”`);
  if (locationIds.length || officeTypeIds.length || departmentIds.length) {
    const [locs, ots, deps] = await Promise.all([
      locationIds.length ? prisma.location.findMany({ where: { id: { in: locationIds } } }) : Promise.resolve([]),
      officeTypeIds.length ? prisma.officeType.findMany({ where: { id: { in: officeTypeIds } } }) : Promise.resolve([]),
      departmentIds.length ? prisma.department.findMany({ where: { id: { in: departmentIds } } }) : Promise.resolve([]),
    ]);
    if (locs.length) summaryParts.push(`Location: ${locs.map((l) => l.name).join(', ')}`);
    if (ots.length) summaryParts.push(`Office type: ${ots.map((o) => o.name).join(', ')}`);
    if (deps.length) summaryParts.push(`Department: ${deps.map((d) => d.name).join(', ')}`);
  }
  if (q) summaryParts.push(`Search: “${q}”`);

  const xlsx = await buildReportWorkbook(report, summaryParts.join(' · '));
  const safeTitle = report.campaign.title.replace(/[^a-z0-9_-]+/gi, '_');
  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeTitle}__report.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
