import { describe, it, expect } from 'vitest';
import { describeError } from '../describe-error';

describe('describeError', () => {
  it('names a refused connection instead of returning an empty string', () => {
    // The regression this exists for. Node throws an AggregateError when it
    // cannot reach a host, and its `message` is ''. The old
    // `err instanceof Error ? err.message : String(err)` logged 1196 identical
    // `{"error":""}` lines while Postgres was simply not running.
    const aggregate = new AggregateError(
      [Object.assign(new Error(''), { code: 'ECONNREFUSED' })],
      '',
    );

    const text = describeError(aggregate);
    expect(text).not.toBe('');
    expect(text).toContain('ECONNREFUSED');
  });

  it('prefers a real message and appends the code when it adds information', () => {
    const err = Object.assign(new Error('password authentication failed'), { code: '28P01' });
    expect(describeError(err)).toBe('password authentication failed (28P01)');
  });

  it('does not repeat a code already present in the message', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5434'), {
      code: 'ECONNREFUSED',
    });
    expect(describeError(err)).toBe('connect ECONNREFUSED 127.0.0.1:5434');
  });

  it('falls back to the code when there is no message', () => {
    expect(describeError(Object.assign(new Error(''), { code: 'ETIMEDOUT' }))).toBe('ETIMEDOUT');
  });

  it('collapses duplicate nested causes rather than repeating one address per family', () => {
    // IPv4 and IPv6 attempts to the same down service produce the same code.
    const aggregate = new AggregateError(
      [
        Object.assign(new Error(''), { code: 'ECONNREFUSED' }),
        Object.assign(new Error(''), { code: 'ECONNREFUSED' }),
      ],
      '',
    );
    expect(describeError(aggregate)).toBe('AggregateError: ECONNREFUSED');
  });

  it('never returns an empty string for any input', () => {
    for (const value of [null, undefined, '', new Error(''), {}, 0]) {
      expect(describeError(value)).not.toBe('');
    }
  });
});
