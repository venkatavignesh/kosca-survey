import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/api';
import { parseCSV } from '@/lib/csv';
import { audit, AUDIT_ACTIONS } from '@/lib/audit';

const REQUIRED_COLS = [
  'empCode', 'name', 'email', 'designation', 'location', 'officeType', 'department',
];

// Limits — keep the import bounded so a misuploaded huge file can't OOM the
// worker or hold a connection for hours.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;   // 5 MB
const MAX_ROWS = 20_000;
const BATCH_SIZE = 50;                       // rows per concurrent Prisma batch

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
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `file too large (>${MAX_UPLOAD_BYTES} bytes)` },
        { status: 413 },
      );
    }
    csvText = await file.text();
    autoCreate = String(fd.get('autoCreate') || 'false') === 'true';
  } else {
    const json = await req.json().catch(() => null);
    csvText = json?.csv || '';
    if (csvText.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'csv too large' }, { status: 413 });
    }
    autoCreate = !!json?.autoCreate;
  }
  if (!csvText.trim()) return NextResponse.json({ error: 'empty CSV' }, { status: 400 });

  const rows = parseCSV(csvText);
  if (rows.length < 2) return NextResponse.json({ error: 'need header + at least one row' }, { status: 400 });
  if (rows.length - 1 > MAX_ROWS) {
    return NextResponse.json({ error: `too many rows (>${MAX_ROWS})` }, { status: 413 });
  }
  const header = rows[0].map((h) => h.trim());
  for (const c of REQUIRED_COLS) {
    if (!header.includes(c)) return NextResponse.json({ error: `missing column: ${c}` }, { status: 400 });
  }
  const idx = Object.fromEntries(header.map((h, i) => [h, i])) as Record<string, number>;

  // Load masters once. Auto-creation of missing masters happens up-front in a
  // single pass so the per-row loop doesn't open + commit a transaction per
  // unknown master.
  const [locations, officeTypes, departments] = await Promise.all([
    prisma.location.findMany(),
    prisma.officeType.findMany(),
    prisma.department.findMany(),
  ]);
  const lc = (s: string) => s.toLowerCase();
  const locMap = new Map(locations.map((l) => [lc(l.name), l.id]));
  const otMap = new Map(officeTypes.map((o) => [lc(o.name), o.id]));
  const deptMap = new Map(departments.map((d) => [lc(d.name), d.id]));

  // Pass 1: discover unknown masters from the rows so we can create them in
  // batch up-front (if autoCreate is true). Avoids one create-round-trip per
  // unknown name per row.
  const needLocs = new Set<string>();
  const needOts = new Set<string>();
  const needDepts = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => !c?.trim())) continue;
    const get = (k: string) => (row[idx[k]] || '').trim();
    const locName = get('location');
    const otName = get('officeType');
    const deptName = get('department');
    if (locName && !locMap.has(lc(locName))) needLocs.add(locName);
    if (otName && !otMap.has(lc(otName))) needOts.add(otName);
    if (deptName && !deptMap.has(lc(deptName))) needDepts.add(deptName);
  }

  if (autoCreate) {
    if (needLocs.size) {
      await prisma.location.createMany({ data: [...needLocs].map((name) => ({ name })), skipDuplicates: true });
      for (const l of await prisma.location.findMany({ where: { name: { in: [...needLocs] } } })) locMap.set(lc(l.name), l.id);
    }
    if (needOts.size) {
      await prisma.officeType.createMany({ data: [...needOts].map((name) => ({ name })), skipDuplicates: true });
      for (const o of await prisma.officeType.findMany({ where: { name: { in: [...needOts] } } })) otMap.set(lc(o.name), o.id);
    }
    if (needDepts.size) {
      await prisma.department.createMany({ data: [...needDepts].map((name) => ({ name })), skipDuplicates: true });
      for (const d of await prisma.department.findMany({ where: { name: { in: [...needDepts] } } })) deptMap.set(lc(d.name), d.id);
    }
  }

  // Pass 2: validate + collect upsert payloads.
  type Payload = {
    rowIndex: number;
    empCode: string;
    data: {
      name: string;
      email: string;
      designation: string;
      locationId: string;
      officeTypeId: string;
      departmentId: string;
    };
  };
  const payloads: Payload[] = [];
  const errors: { row: number; reason: string }[] = [];
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
    const locationId = locMap.get(lc(locName));
    const officeTypeId = otMap.get(lc(otName));
    const departmentId = deptMap.get(lc(deptName));
    if (!locationId || !officeTypeId || !departmentId) {
      errors.push({
        row: r + 1,
        reason: `unknown ${!locationId ? 'location' : ''}${!officeTypeId ? ' officeType' : ''}${!departmentId ? ' department' : ''}`.trim(),
      });
      continue;
    }
    payloads.push({
      rowIndex: r + 1,
      empCode,
      data: { name, email, designation, locationId, officeTypeId, departmentId },
    });
  }

  // Pass 3: batched upserts. Concurrency cap = BATCH_SIZE so we don't open
  // hundreds of connections against the Postgres pool.
  let inserted = 0, updated = 0;
  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const slice = payloads.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      slice.map((p) =>
        prisma.employee.upsert({
          where: { empCode: p.empCode },
          create: { empCode: p.empCode, ...p.data },
          update: p.data,
          select: { id: true, createdAt: true, updatedAt: true },
        }),
      ),
    );
    results.forEach((res, j) => {
      if (res.status === 'fulfilled') {
        // Heuristic: if createdAt equals updatedAt within a tight window, the
        // row was created by this upsert; otherwise it existed already.
        const e = res.value;
        if (Math.abs(e.createdAt.getTime() - e.updatedAt.getTime()) < 50) inserted++;
        else updated++;
      } else {
        const err: any = res.reason;
        errors.push({
          row: slice[j].rowIndex,
          reason: err?.code === 'P2002' ? 'duplicate empCode' : (err?.message || 'failed'),
        });
      }
    });
  }

  await audit({
    action: AUDIT_ACTIONS.EMPLOYEE_IMPORT,
    userId: auth.session.user.id,
    actorEmail: auth.session.user.email,
    entityType: 'Employee',
    metadata: { inserted, updated, errorCount: errors.length, rowsAttempted: payloads.length + errors.length },
  });

  return NextResponse.json({ inserted, updated, errors });
}
