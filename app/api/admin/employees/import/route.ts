import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';
import { parseCSV } from '@/lib/csv';

const REQUIRED_COLS = [
  'empCode', 'name', 'email', 'designation', 'location', 'officeType', 'department',
];

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const ct = req.headers.get('content-type') || '';
  let csvText = '';
  let autoCreate = false;

  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData();
    const file = fd.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });
    csvText = await file.text();
    autoCreate = String(fd.get('autoCreate') || 'false') === 'true';
  } else {
    const json = await req.json().catch(() => null);
    csvText = json?.csv || '';
    autoCreate = !!json?.autoCreate;
  }
  if (!csvText.trim()) return NextResponse.json({ error: 'empty CSV' }, { status: 400 });

  const rows = parseCSV(csvText);
  if (rows.length < 2) return NextResponse.json({ error: 'need header + at least one row' }, { status: 400 });
  const header = rows[0].map((h) => h.trim());
  for (const c of REQUIRED_COLS) {
    if (!header.includes(c)) return NextResponse.json({ error: `missing column: ${c}` }, { status: 400 });
  }
  const idx = Object.fromEntries(header.map((h, i) => [h, i])) as Record<string, number>;

  // load masters
  const [locations, officeTypes, departments] = await Promise.all([
    prisma.location.findMany(),
    prisma.officeType.findMany(),
    prisma.department.findMany(),
  ]);
  const byName = (xs: { id: string; name: string }[]) =>
    new Map(xs.map((x) => [x.name.toLowerCase(), x.id]));
  const locMap = byName(locations);
  const otMap = byName(officeTypes);
  const deptMap = byName(departments);

  async function ensureMaster(kind: 'location' | 'officeType' | 'department', name: string): Promise<string | null> {
    const map = kind === 'location' ? locMap : kind === 'officeType' ? otMap : deptMap;
    const key = name.toLowerCase();
    if (map.has(key)) return map.get(key)!;
    if (!autoCreate) return null;
    const created = kind === 'location'
      ? await prisma.location.create({ data: { name } })
      : kind === 'officeType'
        ? await prisma.officeType.create({ data: { name } })
        : await prisma.department.create({ data: { name } });
    map.set(key, created.id);
    return created.id;
  }

  const errors: { row: number; reason: string }[] = [];
  let inserted = 0, updated = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => !c?.trim())) continue;
    const get = (k: string) => (row[idx[k]] || '').trim();
    const empCode = get('empCode');
    const name = get('name');
    const email = get('email').toLowerCase();
    const designation = get('designation');
    const locName = get('location');
    const otName = get('officeType');
    const deptName = get('department');

    if (!empCode || !name || !email || !designation || !locName || !otName || !deptName) {
      errors.push({ row: r + 1, reason: 'missing required fields' });
      continue;
    }

    const locationId = await ensureMaster('location', locName);
    const officeTypeId = await ensureMaster('officeType', otName);
    const departmentId = await ensureMaster('department', deptName);
    if (!locationId || !officeTypeId || !departmentId) {
      errors.push({
        row: r + 1,
        reason: `unknown ${!locationId ? 'location' : ''}${!officeTypeId ? ' officeType' : ''}${!departmentId ? ' department' : ''}`.trim(),
      });
      continue;
    }

    try {
      const existing = await prisma.employee.findUnique({ where: { empCode } });
      if (existing) {
        await prisma.employee.update({
          where: { id: existing.id },
          data: { name, email, designation, locationId, officeTypeId, departmentId },
        });
        updated++;
      } else {
        await prisma.employee.create({
          data: { empCode, name, email, designation, locationId, officeTypeId, departmentId },
        });
        inserted++;
      }
    } catch (e: any) {
      errors.push({ row: r + 1, reason: e.code === 'P2002' ? 'duplicate empCode' : (e.message || 'failed') });
    }
  }

  return NextResponse.json({ inserted, updated, errors });
}
