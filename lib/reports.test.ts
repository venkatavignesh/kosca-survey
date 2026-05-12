import { describe, it, expect, vi, beforeEach } from 'vitest';

const { campaignFindUnique, assignmentFindMany } = vi.hoisted(() => ({
  campaignFindUnique: vi.fn(),
  assignmentFindMany: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique },
    campaignAssignment: { findMany: assignmentFindMany },
  },
}));
vi.mock('./db', () => ({
  prisma: {
    campaign: { findUnique: campaignFindUnique },
    campaignAssignment: { findMany: assignmentFindMany },
  },
}));
vi.mock('react', () => ({ cache: (fn: any) => fn }));

import { getQuestionReport, getGroupReports } from './reports';

beforeEach(() => {
  campaignFindUnique.mockReset();
  assignmentFindMany.mockReset();
});

const baseCampaign = (overrides: any = {}) => ({
  id: 'c1',
  title: 'Test',
  questionGroups: overrides.questionGroups ?? [
    { id: 'g1', name: 'Agility', order: 0, createdAt: new Date() },
  ],
  questions: overrides.questions ?? [
    {
      groupId: 'g1',
      order: 0,
      question: {
        id: 'q1',
        text: 'How do you feel?',
        type: 'RADIO',
        options: ['Very positive', 'Positive', 'Negative', 'Very negative'],
        allowText: false,
      },
    },
  ],
});

describe('getQuestionReport', () => {
  it('returns null for missing campaign', async () => {
    campaignFindUnique.mockResolvedValueOnce(null);
    expect(await getQuestionReport('missing')).toBeNull();
  });

  it('returns campaign + empty selection when questionId is absent', async () => {
    campaignFindUnique.mockResolvedValueOnce(baseCampaign());
    const r = await getQuestionReport('c1');
    expect(r?.question).toBeNull();
    expect(r?.totalAnswered).toBe(0);
    expect(r?.campaign.questions[0].id).toBe('q1');
  });

  it('counts option occurrences for the selected question', async () => {
    campaignFindUnique.mockResolvedValueOnce(baseCampaign());
    assignmentFindMany.mockResolvedValueOnce([
      {
        id: 'a1',
        submittedAt: new Date(),
        employee: {
          empCode: 'E1', name: 'Alice', email: 'a@x', designation: 'D',
          location: { name: 'L' }, officeType: { name: 'O' }, department: { name: 'Dept' },
        },
        response: { answers: [{ questionId: 'q1', valueOptions: ['Very positive'], valueText: null }] },
      },
      {
        id: 'a2',
        submittedAt: new Date(),
        employee: {
          empCode: 'E2', name: 'Bob', email: 'b@x', designation: 'D',
          location: { name: 'L' }, officeType: { name: 'O' }, department: { name: 'Dept' },
        },
        response: { answers: [{ questionId: 'q1', valueOptions: ['Positive'], valueText: null }] },
      },
    ]);
    const r = await getQuestionReport('c1', { questionId: 'q1' });
    expect(r?.totalAnswered).toBe(2);
    expect(r?.optionCounts).toEqual([
      { option: 'Very positive', count: 1 },
      { option: 'Positive', count: 1 },
      { option: 'Negative', count: 0 },
      { option: 'Very negative', count: 0 },
    ]);
    expect(r?.matches).toHaveLength(2);
  });

  it('filters by selectedOptions', async () => {
    campaignFindUnique.mockResolvedValueOnce(baseCampaign());
    assignmentFindMany.mockResolvedValueOnce([
      {
        id: 'a1', submittedAt: new Date(),
        employee: { empCode: 'E1', name: 'A', email: '', designation: '',
          location: { name: '' }, officeType: { name: '' }, department: { name: '' } },
        response: { answers: [{ questionId: 'q1', valueOptions: ['Very positive'], valueText: null }] },
      },
      {
        id: 'a2', submittedAt: new Date(),
        employee: { empCode: 'E2', name: 'B', email: '', designation: '',
          location: { name: '' }, officeType: { name: '' }, department: { name: '' } },
        response: { answers: [{ questionId: 'q1', valueOptions: ['Negative'], valueText: null }] },
      },
    ]);
    const r = await getQuestionReport('c1', { questionId: 'q1', selectedOptions: ['Negative'] });
    expect(r?.matches.map((m) => m.empCode)).toEqual(['E2']);
  });
});

describe('getGroupReports', () => {
  it('returns [] when campaign missing', async () => {
    campaignFindUnique.mockResolvedValueOnce(null);
    expect(await getGroupReports('missing')).toEqual([]);
  });

  it('aggregates choice answers into A/B/C/D buckets per group', async () => {
    campaignFindUnique.mockResolvedValueOnce(baseCampaign({
      questions: [
        {
          groupId: 'g1', order: 0,
          question: { id: 'q1', text: 'Q1', type: 'RADIO',
            options: ['Very positive', 'Positive', 'Negative', 'Very negative'], allowText: false },
        },
        {
          groupId: 'g1', order: 1,
          question: { id: 'q2', text: 'Q2', type: 'RADIO',
            options: ['Strongly agree', 'Agree', 'Disagree', 'Strongly disagree'], allowText: false },
        },
      ],
    }));
    assignmentFindMany.mockResolvedValueOnce([
      { id: 'a1', submittedAt: new Date(),
        employee: { empCode: 'E1', name: 'A', email: '', designation: '',
          location: { name: '' }, officeType: { name: '' }, department: { name: '' } },
        response: { answers: [
          { questionId: 'q1', valueOptions: ['Very positive'], valueText: null },
          { questionId: 'q2', valueOptions: ['Agree'], valueText: null },
        ]},
      },
    ]);
    const r = await getGroupReports('c1');
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('Agility');
    expect(r[0].questionCount).toBe(2);
    const a = r[0].buckets.find((b) => b.letter === 'A')!;
    const b = r[0].buckets.find((b) => b.letter === 'B')!;
    expect(a.count).toBe(1);
    expect(b.count).toBe(1);
  });

  it('skips TEXT questions (no buckets defined)', async () => {
    campaignFindUnique.mockResolvedValueOnce(baseCampaign({
      questions: [
        {
          groupId: 'g1', order: 0,
          question: { id: 'qt', text: 'open', type: 'TEXT', options: null, allowText: true },
        },
      ],
    }));
    assignmentFindMany.mockResolvedValueOnce([]);
    expect(await getGroupReports('c1')).toEqual([]);
  });
});
