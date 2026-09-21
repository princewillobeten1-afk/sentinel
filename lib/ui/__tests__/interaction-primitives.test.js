// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Modal } from '@/components/ui/modal';
import { Tabs } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';

afterEach(cleanup);
describe('shared terminal interactions', () => {
  it('keeps compound popovers closed until activated and supports Escape', () => {
    render(React.createElement(Popover, null,
      React.createElement(PopoverTrigger, { asChild: true }, React.createElement('button', null, 'Wallets')),
      React.createElement(PopoverContent, null, 'Wallet choices')));
    expect(screen.queryByText('Wallet choices')).toBeNull();
    const trigger = screen.getByRole('button', { name: 'Wallets' });
    trigger.focus(); fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Wallet choices')).toBeTruthy();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByText('Wallet choices')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it('closes on outside interaction', () => {
    render(React.createElement(Popover, { trigger: React.createElement('button', null, 'More') }, 'Options'));
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText('Options')).toBeNull();
  });
  it('names dialogs from their rendered title and restores focus and body scroll', () => {
    const opener = document.createElement('button'); document.body.append(opener); opener.focus();
    document.body.style.overflow = 'auto';
    const close = vi.fn();
    const { unmount } = render(React.createElement(Modal, { isOpen: true, onClose: close, title: React.createElement('span', null, 'Preferences') }, 'Settings'));
    expect(screen.getByRole('dialog', { name: 'Preferences' })).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' }); expect(close).toHaveBeenCalledOnce();
    unmount(); expect(document.activeElement).toBe(opener); expect(document.body.style.overflow).toBe('auto');
    opener.remove(); document.body.style.overflow = '';
  });
  it('exposes selected tabs and accessible clear controls', () => {
    const change = vi.fn();
    render(React.createElement(Tabs, { tabs: [{ id: 'a', label: 'Market' }, { id: 'b', label: 'Limit' }], activeTab: 'a', onChange: change }));
    expect(screen.getByRole('button', { name: 'Market' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Limit' })); expect(change).toHaveBeenCalledWith('b');
    const clear = vi.fn(); render(React.createElement(Input, { value: 'SOL', readOnly: true, onClear: clear }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear input' })); expect(clear).toHaveBeenCalledOnce();
  });
  it('uses a real sort button and exposes sort direction', () => {
    const sort = vi.fn();
    render(React.createElement(DataTable, { columns: [{ key: 'name', header: 'Token', sortable: true }], data: [{ name: 'SOL' }], keyExtractor: row => row.name, sortColumn: 'name', sortDirection: 'asc', onSort: sort }));
    expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(screen.getByRole('button', { name: 'Token' })); expect(sort).toHaveBeenCalledWith('name');
  });
});
