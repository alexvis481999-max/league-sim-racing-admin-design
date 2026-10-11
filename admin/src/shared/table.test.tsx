// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FixedTablePagination } from './table';

afterEach(cleanup);

it.each([0, 1, 20])('hides pagination when %i records fit on one page', count => {
  render(<FixedTablePagination count={count} page={0} rowsPerPage={20} onPageChange={vi.fn()} />);
  expect(screen.queryByRole('navigation')).toBeNull();
});

it('navigates using zero-based pages and hides controls when the list becomes empty', () => {
  const onPageChange = vi.fn();
  const { rerender } = render(<FixedTablePagination count={41} page={0} rowsPerPage={20} onPageChange={onPageChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Страница 3' }));
  expect(onPageChange).toHaveBeenCalledWith(2);
  rerender(<FixedTablePagination count={41} page={2} rowsPerPage={20} onPageChange={onPageChange} />);
  expect(screen.getByText('41–41 из 41')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Следующая страница' }).hasAttribute('disabled')).toBe(true);
  rerender(<FixedTablePagination count={0} page={0} rowsPerPage={20} onPageChange={onPageChange} />);
  expect(screen.queryByRole('navigation')).toBeNull();
});
