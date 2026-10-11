import { type ReactNode, type MouseEvent, type KeyboardEvent } from 'react';
import { Pagination, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { AnyRecord } from './types';

/** Keep table semantics and isolate nested links, buttons and form controls. */
export function openableRow(onOpen:()=>void) {
  return {className:'admin-clickable-row',tabIndex:0,
    onClick:(event:MouseEvent<HTMLElement>)=>{if(!(event.target as HTMLElement).closest('button,a,input,select,textarea,[role="button"]'))onOpen();},
    onKeyDown:(event:KeyboardEvent<HTMLElement>)=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onOpen();}},
  };
}

export function EmptyTableRow({ colSpan, label = 'Пока пусто.' }: { colSpan: number; label?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center" useFlexGap flexWrap="wrap">
      {children}
    </Stack>
  );
}

export function FixedTablePagination({
  count,
  page,
  rowsPerPage,
  onPageChange,
}: {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
}) {
  if (count <= rowsPerPage || rowsPerPage <= 0) return null;
  const pages = Math.ceil(count / rowsPerPage);
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" gap={1} sx={{ pt: 2 }}>
      <Typography variant="body2" color="text.secondary">{page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, count)} из {count}</Typography>
      <Pagination aria-label="Страницы списка" count={pages} page={page + 1} size="small" shape="rounded" color="primary"
        onChange={(_, nextPage) => onPageChange(nextPage - 1)}
        getItemAriaLabel={(type, number) => type === 'page' ? `Страница ${number}` : type === 'previous' ? 'Предыдущая страница' : type === 'next' ? 'Следующая страница' : type === 'first' ? 'Первая страница' : 'Последняя страница'} />
    </Stack>
  );
}

export function SimpleDataTable({ rows, primaryKeys }: { rows: unknown[]; primaryKeys: string[] }) {
  if (!rows.length) {
    return <Typography variant="body2" color="text.secondary">Данных пока нет или backend вернул пустой список.</Typography>;
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          {primaryKeys.map((key) => <TableCell key={key}>{key}</TableCell>)}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, index) => {
          const item = row && typeof row === 'object' ? row as AnyRecord : {};
          return (
            <TableRow key={String(item.id ?? item.code ?? index)} hover>
              {primaryKeys.map((key) => <TableCell key={key}>{String(item[key] ?? '-')}</TableCell>)}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
