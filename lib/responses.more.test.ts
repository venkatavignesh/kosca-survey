import { describe, it, expect } from 'vitest';
import { buildCsv } from './responses';

// Minimal fixture shaped to what buildCsv reads from a getCampaignWithResponses
// return value. We bypass Prisma entirely — buildCsv is a pure transform.

const submittedAt = new Date('2026-04-05T00:50:00Z');
const emp = (over: Partial<any> = {}) => ({
  empCode: 'E1', name: 'Alice', email: 'a@x', designation: 'Dev',
  location: { name: 'Chennai' }, officeType: { name: 'HO' }, department: { name: 'IT' },
  ...over,
});

describe('buildCsv', () => {
  const baseCampaign = (questions: any[]) => ({
    id: 'c1', title: 'Test', questions,
  });

  it('emits the canonical header row', () => {
    const data: any = {
      campaign: baseCampaign([]),
      assignments: [],
    };
    const csv = buildCsv(data);
    const head = csv.split('\n')[0];
    expect(head).toContain('empCode,name,email,designation');
    expect(head).toContain('location,officeType,department');
    expect(head).toContain('emailSentAt,emailOpenedAt,submittedAt');
  });

  it('includes one column per campaign question', () => {
    const data: any = {
      campaign: baseCampaign([
        { question: { id: 'q1', text: 'Q one', type: 'RADIO', allowText: false } },
        { question: { id: 'q2', text: 'Q two', type: 'TEXT', allowText: false } },
      ]),
      assignments: [],
    };
    const csv = buildCsv(data);
    const head = csv.split('\n')[0];
    expect(head).toContain('Q one');
    expect(head).toContain('Q two');
  });

  it('joins multi-option answers with semicolons', () => {
    const data: any = {
      campaign: baseCampaign([
        { question: { id: 'q1', text: 'Q', type: 'CHECKBOX', allowText: false } },
      ]),
      assignments: [{
        employee: emp(),
        emailSentAt: null, emailOpenedAt: null, submittedAt,
        response: { answers: [{ questionId: 'q1', valueOptions: ['A', 'B'], valueText: null }] },
      }],
    };
    const csv = buildCsv(data);
    const dataRow = csv.split('\n')[1];
    expect(dataRow.endsWith('A; B')).toBe(true);
  });

  it('appends a comment after options when allowText is on', () => {
    const data: any = {
      campaign: baseCampaign([
        { question: { id: 'q1', text: 'Q', type: 'RADIO', allowText: true } },
      ]),
      assignments: [{
        employee: emp(),
        emailSentAt: null, emailOpenedAt: null, submittedAt,
        response: { answers: [{ questionId: 'q1', valueOptions: ['A'], valueText: '  context  ' }] },
      }],
    };
    const csv = buildCsv(data);
    expect(csv).toContain('A | context');
  });

  it('renders TEXT answers as the raw valueText', () => {
    const data: any = {
      campaign: baseCampaign([
        { question: { id: 'q1', text: 'Q', type: 'TEXT', allowText: false } },
      ]),
      assignments: [{
        employee: emp(),
        emailSentAt: null, emailOpenedAt: null, submittedAt,
        response: { answers: [{ questionId: 'q1', valueOptions: null, valueText: 'free text' }] },
      }],
    };
    expect(buildCsv(data)).toContain('free text');
  });

  it('emits empty cell for missing answer', () => {
    const data: any = {
      campaign: baseCampaign([
        { question: { id: 'q1', text: 'Q', type: 'RADIO', allowText: false } },
      ]),
      assignments: [{
        employee: emp(),
        emailSentAt: null, emailOpenedAt: null, submittedAt: null,
        response: null,
      }],
    };
    const row = buildCsv(data).split('\n')[1];
    // Last column is the answer; for no response it must be empty (trailing comma + newline).
    expect(row.endsWith(',')).toBe(true);
  });
});
