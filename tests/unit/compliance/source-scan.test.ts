import { describe, it, expect } from 'vitest';

import {
  PDS_WRITE_CALLS,
  findCalls,
  readExecutableSource,
  stripCommentsAndStrings,
} from '../../compliance/helpers/source-scan.js';

describe('stripCommentsAndStrings', () => {
  it('blanks line comments', () => {
    const out = stripCommentsAndStrings('const a = 1; // createRecord(x)\nconst b = 2;');
    expect(out).not.toContain('createRecord');
    expect(out).toContain('const a = 1;');
    expect(out).toContain('const b = 2;');
  });

  it('blanks block comments, including multi-line ones', () => {
    const out = stripCommentsAndStrings('/* NO createRecord\n   here */ const a = 1;');
    expect(out).not.toContain('createRecord');
    expect(out).toContain('const a = 1;');
  });

  it('blanks the contents of every string form', () => {
    const out = stripCommentsAndStrings(
      `const a = 'createRecord('; const b = "putRecord("; const c = \`deleteRecord(\`;`
    );
    expect(out).not.toContain('createRecord');
    expect(out).not.toContain('putRecord');
    expect(out).not.toContain('deleteRecord');
  });

  it('does not treat an apostrophe inside a comment as a string opener', () => {
    // Without comment handling running first, the apostrophe in "doesn't"
    // would open a string and swallow the real call on the next line.
    const out = stripCommentsAndStrings("// this doesn't write\nagent.createRecord(x);");
    expect(out).toContain('createRecord');
  });

  it('does not treat a quote inside a string as a comment', () => {
    const out = stripCommentsAndStrings(`const a = 'http://example.com'; agent.putRecord(x);`);
    expect(out).toContain('putRecord');
    expect(out).not.toContain('example.com');
  });

  it('handles an escaped quote without ending the string early', () => {
    const out = stripCommentsAndStrings(`const a = 'it\\'s createRecord('; const b = 2;`);
    expect(out).not.toContain('createRecord');
    expect(out).toContain('const b = 2;');
  });

  it('preserves length so offsets still line up', () => {
    const input = "const a = 'hidden'; // note\nconst b = 2;";
    expect(stripCommentsAndStrings(input)).toHaveLength(input.length);
  });

  it('preserves newlines so line numbers still line up', () => {
    const input = '/* one\ntwo\nthree */\nconst a = 1;';
    const out = stripCommentsAndStrings(input);
    expect(out.split('\n')).toHaveLength(input.split('\n').length);
  });

  it('leaves ordinary code untouched', () => {
    const input = 'const x = a / b; const y = c /= d;';
    expect(stripCommentsAndStrings(input)).toBe(input);
  });
});

describe('findCalls', () => {
  it('finds a method call on a receiver', () => {
    expect(findCalls('agent.createRecord(x)', PDS_WRITE_CALLS)).toEqual(['createRecord']);
  });

  it('finds a bare call', () => {
    expect(findCalls('createRecord(x)', PDS_WRITE_CALLS)).toEqual(['createRecord']);
  });

  it('finds a call carrying an explicit type argument', () => {
    expect(findCalls('repo.getRecord<RawFacetRecord>(uri)', ['getRecord'])).toEqual(['getRecord']);
  });

  it('finds a call carrying nested type arguments', () => {
    expect(findCalls('repo.listRecords<Map<string, Raw>>(nsid)', ['listRecords'])).toEqual([
      'listRecords',
    ]);
  });

  it('tolerates whitespace before the parenthesis', () => {
    expect(findCalls('agent.putRecord  (x)', PDS_WRITE_CALLS)).toEqual(['putRecord']);
  });

  it('does not match a longer identifier that ends with the method name', () => {
    expect(findCalls('safeCreateRecord(x)', ['createRecord'])).toEqual([]);
  });

  it('does not match a longer identifier that starts with the method name', () => {
    expect(findCalls('createRecordSafely(x)', ['createRecord'])).toEqual([]);
  });

  it('does not match a property read', () => {
    expect(findCalls('const f = agent.createRecord;', ['createRecord'])).toEqual([]);
  });

  it('returns nothing for source with no calls', () => {
    expect(findCalls('const a = 1;', PDS_WRITE_CALLS)).toEqual([]);
  });

  it('deduplicates repeated calls', () => {
    expect(findCalls('a.putRecord(x); b.putRecord(y);', ['putRecord'])).toEqual(['putRecord']);
  });
});

describe('readExecutableSource', () => {
  it('reads a real file and strips its comments', () => {
    const source = readExecutableSource('tests/compliance/helpers/source-scan.ts');
    expect(source.length).toBeGreaterThan(0);
    // The forbidden names appear throughout this file's own prose and in the
    // PDS_WRITE_CALLS literal; neither is a call, so neither should survive.
    expect(findCalls(source, ['createRecord', 'putRecord'])).toEqual([]);
  });

  it('throws rather than returning empty for a missing file', () => {
    // A compliance test naming a moved file must fail, not pass vacuously.
    expect(() => readExecutableSource('src/does/not/exist.ts')).toThrow();
  });
});
