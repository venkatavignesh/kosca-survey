import { cache } from 'react';
import { prisma } from './db';
import { applyEmployeeFilters, type EmployeeFilters } from './responses';
import ExcelJS from 'exceljs';
import { formatDateTime } from './dates';
import { COLORS, thinBorder, loadLogo, addBrandHeader } from './excel-brand';

// Deduplicate per-request: both getQuestionReport and getGroupReports need the same
// campaign + questions metadata. With React's cache() the DB hit runs once.
const loadCampaignWithQuestions = cache(async (campaignId: string) => {
  return prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      questionGroups: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
      questions: { orderBy: { order: 'asc' }, include: { question: true } },
    },
  });
});

const loadSubmittedAssignments = cache(async (campaignId: string, filtersKey: string, where: any) => {
  // filtersKey participates in cache identity so different demographic filters
  // produce different cache entries within the same render.
  void filtersKey;
  return prisma.campaignAssignment.findMany({
    where,
    include: {
      employee: { include: { location: true, officeType: true, department: true } },
      response: { include: { answers: true } },
    },
    orderBy: { employee: { empCode: 'asc' } },
  });
});

export type ReportFilters = EmployeeFilters & {
  questionId?: string;
  selectedOptions?: string[];
  textQuery?: string;
};

export type QuestionLite = {
  id: string;
  text: string;
  type: 'RADIO' | 'CHECKBOX' | 'MCQ_SINGLE' | 'MCQ_MULTI' | 'TEXT' | 'LONG_TEXT';
  options: string[];
  allowText: boolean;
};

export type ReportMatch = {
  assignmentId: string;
  empCode: string;
  name: string;
  designation: string;
  email: string;
  group: { location: string; officeType: string; department: string };
  submittedAt: Date;
  answer: { options: string[]; text: string | null };
};

export type QuestionReport = {
  campaign: { id: string; title: string; questions: QuestionLite[] };
  question: QuestionLite | null;
  optionCounts: { option: string; count: number }[];
  totalAnswered: number;
  matches: ReportMatch[];
};

function asOptionList(opts: unknown): string[] {
  if (!opts) return [];
  if (Array.isArray(opts)) {
    return opts.map((o) => (typeof o === 'string' ? o : o && typeof o === 'object' && 'label' in (o as any) ? String((o as any).label) : String(o)));
  }
  return [];
}

function asAnswerOptions(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [];
}

const isText = (t: QuestionLite['type']) => t === 'TEXT' || t === 'LONG_TEXT';

export async function getQuestionReport(campaignId: string, opts: ReportFilters = {}): Promise<QuestionReport | null> {
  const campaign = await loadCampaignWithQuestions(campaignId);
  if (!campaign) return null;

  const questions: QuestionLite[] = campaign.questions.map((cq) => ({
    id: cq.question.id,
    text: cq.question.text,
    type: cq.question.type as QuestionLite['type'],
    options: asOptionList(cq.question.options),
    allowText: cq.question.allowText,
  }));

  const head = { campaign: { id: campaign.id, title: campaign.title, questions } };

  if (!opts.questionId) {
    return { ...head, question: null, optionCounts: [], totalAnswered: 0, matches: [] };
  }
  const question = questions.find((q) => q.id === opts.questionId);
  if (!question) {
    return { ...head, question: null, optionCounts: [], totalAnswered: 0, matches: [] };
  }

  // Pull every submitted assignment matching the demographic / q filter, with
  // their answer to the chosen question (if any). One round-trip; counts and
  // matches both derived from this set.
  const where: any = applyEmployeeFilters({ campaignId, submittedAt: { not: null } }, opts);
  const filtersKey = JSON.stringify({
    locationIds: opts.locationIds || [],
    officeTypeIds: opts.officeTypeIds || [],
    departmentIds: opts.departmentIds || [],
    q: opts.q || '',
  });
  const assignments = await loadSubmittedAssignments(campaignId, filtersKey, where);

  const counts = new Map<string, number>();
  // Seed every defined option with 0 so the distribution UI lists them all.
  for (const o of question.options) counts.set(o, 0);

  let totalAnswered = 0;
  const allMatches: ReportMatch[] = [];

  for (const a of assignments) {
    const ans = a.response?.answers?.find((x) => x.questionId === question.id);
    if (!ans) continue;
    const optList = asAnswerOptions(ans.valueOptions);
    const text = ans.valueText || null;
    const hasSomething = optList.length > 0 || (text && text.trim().length > 0);
    if (!hasSomething) continue;
    totalAnswered++;
    if (!isText(question.type)) {
      for (const o of optList) counts.set(o, (counts.get(o) ?? 0) + 1);
    }
    allMatches.push({
      assignmentId: a.id,
      empCode: a.employee.empCode,
      name: a.employee.name,
      designation: a.employee.designation,
      email: a.employee.email,
      group: {
        location: a.employee.location.name,
        officeType: a.employee.officeType.name,
        department: a.employee.department.name,
      },
      submittedAt: a.submittedAt!,
      answer: { options: optList, text },
    });
  }

  // Apply per-question filter (selected options OR text query).
  let matches = allMatches;
  if (isText(question.type)) {
    const tq = opts.textQuery?.trim().toLowerCase();
    if (tq) {
      matches = matches.filter((m) => (m.answer.text || '').toLowerCase().includes(tq));
    }
  } else if (opts.selectedOptions && opts.selectedOptions.length > 0) {
    const sel = new Set(opts.selectedOptions);
    matches = matches.filter((m) => m.answer.options.some((o) => sel.has(o)));
  }

  // Distribution: maintain question-defined option order, then any extras.
  const ordered: { option: string; count: number }[] = [];
  for (const o of question.options) ordered.push({ option: o, count: counts.get(o) ?? 0 });
  for (const [o, c] of counts) {
    if (!question.options.includes(o)) ordered.push({ option: o, count: c });
  }

  return { ...head, question, optionCounts: ordered, totalAnswered, matches };
}

// ---------- Group aggregation (A/B/C/D buckets, internal-only) ----------

export type GroupQuestionBreakdown = {
  questionId: string;
  position: number; // 1-based slot in the campaign questionnaire
  text: string;
  options: string[];
  buckets: { letter: string; count: number }[];
  totalAnswered: number;
};

export type GroupReport = {
  groupId: string; // '' = Ungrouped
  name: string;
  buckets: { letter: string; count: number }[]; // A, B, C, …
  totalAnswered: number;
  questionCount: number;
  questions: GroupQuestionBreakdown[];
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export async function getGroupReports(
  campaignId: string,
  opts: EmployeeFilters = {},
): Promise<GroupReport[]> {
  const campaign = await loadCampaignWithQuestions(campaignId);
  if (!campaign) return [];

  // Build group lookup. Skip TEXT/LONG_TEXT — they don't bucket.
  type Bag = { name: string; options: Map<string, string[]>; bucketSize: number; questionCount: number; questionOrder: { id: string; text: string; position: number }[] };
  const bags = new Map<string, Bag>();
  for (const g of campaign.questionGroups) bags.set(g.id, { name: g.name, options: new Map(), bucketSize: 0, questionCount: 0, questionOrder: [] });
  bags.set('', { name: 'Ungrouped', options: new Map(), bucketSize: 0, questionCount: 0, questionOrder: [] });

  const questionToGroup = new Map<string, string>();
  campaign.questions.forEach((cq, idx) => {
    if (isText(cq.question.type as QuestionLite['type'])) return;
    const gid = cq.groupId ?? '';
    const bag = bags.get(gid);
    if (!bag) return;
    const optList = asOptionList(cq.question.options);
    if (optList.length === 0) return;
    bag.options.set(cq.question.id, optList);
    bag.bucketSize = Math.max(bag.bucketSize, Math.min(optList.length, LETTERS.length));
    bag.questionCount += 1;
    bag.questionOrder.push({ id: cq.question.id, text: cq.question.text, position: idx + 1 });
    questionToGroup.set(cq.question.id, gid);
  });

  if (questionToGroup.size === 0) return [];

  const where: any = applyEmployeeFilters({ campaignId, submittedAt: { not: null } }, opts);
  const filtersKey = JSON.stringify({
    locationIds: opts.locationIds || [],
    officeTypeIds: opts.officeTypeIds || [],
    departmentIds: opts.departmentIds || [],
    q: opts.q || '',
  });
  const assignments = await loadSubmittedAssignments(campaignId, filtersKey, where);
  const questionIds = new Set(questionToGroup.keys());

  // Tally per (group, letter) and per (question, letter).
  const counts = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  for (const gid of bags.keys()) {
    const m = new Map<string, number>();
    for (const l of LETTERS) m.set(l, 0);
    counts.set(gid, m);
    totals.set(gid, 0);
  }
  const qCounts = new Map<string, Map<string, number>>();
  const qTotals = new Map<string, number>();
  for (const qid of questionToGroup.keys()) {
    const m = new Map<string, number>();
    for (const l of LETTERS) m.set(l, 0);
    qCounts.set(qid, m);
    qTotals.set(qid, 0);
  }

  for (const a of assignments) {
    const answers = a.response?.answers ?? [];
    for (const ans of answers) {
      if (!questionIds.has(ans.questionId)) continue;
      const gid = questionToGroup.get(ans.questionId);
      if (gid === undefined) continue;
      const bag = bags.get(gid)!;
      const opts = bag.options.get(ans.questionId);
      if (!opts) continue;
      const picked = asAnswerOptions(ans.valueOptions);
      if (picked.length === 0) continue;
      let counted = false;
      for (const p of picked) {
        const idx = opts.indexOf(p);
        if (idx < 0 || idx >= LETTERS.length) continue;
        counts.get(gid)!.set(LETTERS[idx], (counts.get(gid)!.get(LETTERS[idx]) ?? 0) + 1);
        qCounts.get(ans.questionId)!.set(LETTERS[idx], (qCounts.get(ans.questionId)!.get(LETTERS[idx]) ?? 0) + 1);
        counted = true;
      }
      if (counted) {
        totals.set(gid, (totals.get(gid) ?? 0) + 1);
        qTotals.set(ans.questionId, (qTotals.get(ans.questionId) ?? 0) + 1);
      }
    }
  }

  const out: GroupReport[] = [];
  // Preserve group order from campaign.questionGroups, then Ungrouped last.
  const orderedIds = [...campaign.questionGroups.map((g) => g.id), ''];
  for (const gid of orderedIds) {
    const bag = bags.get(gid);
    if (!bag || bag.questionCount === 0) continue;
    const letters = LETTERS.slice(0, bag.bucketSize);
    const buckets = letters.map((l) => ({ letter: l, count: counts.get(gid)!.get(l) ?? 0 }));
    const questions: GroupQuestionBreakdown[] = bag.questionOrder.map((q) => {
      const opts = bag.options.get(q.id) ?? [];
      const qLetters = LETTERS.slice(0, Math.min(opts.length, LETTERS.length));
      return {
        questionId: q.id,
        position: q.position,
        text: q.text,
        options: opts,
        buckets: qLetters.map((l) => ({ letter: l, count: qCounts.get(q.id)!.get(l) ?? 0 })),
        totalAnswered: qTotals.get(q.id) ?? 0,
      };
    });
    out.push({
      groupId: gid,
      name: bag.name,
      buckets,
      totalAnswered: totals.get(gid) ?? 0,
      questionCount: bag.questionCount,
      questions,
    });
  }
  return out;
}

// ---------- XLSX export of the filtered match list ----------

export async function buildReportWorkbook(report: QuestionReport, filtersSummary: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Kosca Distribution LLP — Survey';
  wb.company = 'Kosca Distribution LLP';
  wb.title = `${report.campaign.title} — Report`;
  wb.created = new Date();
  const logoId = loadLogo(wb);

  const ws = wb.addWorksheet('Report', {
    views: [{ state: 'frozen', ySplit: 4 }],
    properties: { tabColor: { argb: COLORS.brand } },
  });
  ws.columns = [
    { key: 'empCode', width: 12 },
    { key: 'name', width: 24 },
    { key: 'designation', width: 22 },
    { key: 'location', width: 16 },
    { key: 'officeType', width: 18 },
    { key: 'department', width: 18 },
    { key: 'email', width: 28 },
    { key: 'submittedAt', width: 22 },
    { key: 'answer', width: 50 },
  ];

  const subtitle = `${report.campaign.title}  ·  ${report.question ? `Q: ${report.question.text}` : 'No question selected'}${filtersSummary ? `  ·  ${filtersSummary}` : ''}`;
  addBrandHeader(ws, logoId, subtitle, ws.columns.length);

  const headerLabels = ['Emp. Code', 'Name', 'Designation', 'Location', 'Office Type', 'Department', 'Email', 'Submitted At', 'Answer'];
  const headerRow = ws.getRow(4);
  headerRow.values = headerLabels;
  headerRow.height = 22;
  headerRow.font = { bold: true, color: { argb: COLORS.white }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brand } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.eachCell((cell) => { cell.border = thinBorder(); });

  report.matches.forEach((m, i) => {
    const optsCell = m.answer.options.join('; ');
    const answerCell = m.answer.text && m.answer.text.trim()
      ? (optsCell ? `${optsCell} | ${m.answer.text.trim()}` : m.answer.text.trim())
      : (optsCell || '—');
    const row = ws.addRow({
      empCode: m.empCode,
      name: m.name,
      designation: m.designation,
      location: m.group.location,
      officeType: m.group.officeType,
      department: m.group.department,
      email: m.email,
      submittedAt: formatDateTime(m.submittedAt),
      answer: answerCell,
    });
    const isZebra = i % 2 === 1;
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((cell) => {
      cell.border = thinBorder();
      if (isZebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brandLight } };
    });
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
