import { describe, it, expect } from 'vitest';
import { renderTemplate } from './templates';

describe('renderTemplate', () => {
  it('substitutes simple variables', () => {
    expect(renderTemplate('Hi {{name}}', { name: 'Vignesh' })).toBe('Hi Vignesh');
  });
  it('renders null/undefined as empty string', () => {
    expect(renderTemplate('Hi {{name}}!', { name: null })).toBe('Hi !');
    expect(renderTemplate('Hi {{name}}!', { name: undefined })).toBe('Hi !');
  });
  it('keeps conditional section when variable is truthy', () => {
    expect(renderTemplate('A{{#x}}-{{x}}{{/x}}B', { x: 'YES' })).toBe('A-YESB');
  });
  it('drops conditional section when variable is falsy', () => {
    expect(renderTemplate('A{{#x}}-{{x}}{{/x}}B', { x: '' })).toBe('AB');
    expect(renderTemplate('A{{#x}}-{{x}}{{/x}}B', { x: null })).toBe('AB');
  });
  it('handles nested sections', () => {
    const out = renderTemplate('{{#a}}A{{#b}}B{{/b}}{{/a}}', { a: '1', b: '1' });
    expect(out).toBe('AB');
  });
  it('tolerates whitespace inside braces', () => {
    expect(renderTemplate('{{ name }}', { name: 'x' })).toBe('x');
  });
  it('does not substitute unknown vars', () => {
    expect(renderTemplate('{{name}} {{other}}', { name: 'x' })).toBe('x ');
  });
});
