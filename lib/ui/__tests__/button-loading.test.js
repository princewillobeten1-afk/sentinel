import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '@/components/ui/button';

describe('busy button accessibility', () => {
  it('preserves the visible action name and disables native activation while busy', () => {
    const busy = renderToStaticMarkup(React.createElement(Button, { isLoading: true }, 'Refresh tokens'));
    expect(busy).toContain('Refresh tokens');
    expect(busy).toContain('aria-busy="true"');
    expect(busy).toContain('disabled=""');
    const ready = renderToStaticMarkup(React.createElement(Button, { isLoading: false }, 'Refresh tokens'));
    expect(ready).toContain('Refresh tokens');
    expect(ready).not.toContain('aria-busy="true"');
    expect(ready).not.toContain('disabled=""');
  });
});
