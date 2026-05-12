import { describe, it, expect } from 'vitest';
import { parseCSV, toCSV } from './csv';

describe('parseCSV', () => {
  it('parses simple rows', () => {
    expect(parseCSV('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });
  it('handles quoted fields with commas and newlines', () => {
    expect(parseCSV('a,"b,c","d\ne"')).toEqual([['a', 'b,c', 'd\ne']]);
  });
  it('handles escaped quotes', () => {
    expect(parseCSV('a,"He said ""hi""",c')).toEqual([['a', 'He said "hi"', 'c']]);
  });
  it('strips empty trailing rows', () => {
    expect(parseCSV('a,b\n\n')).toEqual([['a', 'b']]);
  });
  it('handles CRLF', () => {
    expect(parseCSV('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('toCSV', () => {
  it('escapes fields that contain commas or quotes', () => {
    const out = toCSV(['a', 'b'], [['hi, there', 'say "yo"']]);
    expect(out).toContain('"hi, there"');
    expect(out).toContain('"say ""yo"""');
  });
  it('renders null and undefined as empty', () => {
    const out = toCSV(['a', 'b'], [[null, undefined]]);
    expect(out).toBe('a,b\n,\n');
  });
});
