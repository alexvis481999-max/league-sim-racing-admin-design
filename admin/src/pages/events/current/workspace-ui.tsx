import type { ReactNode } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type { WorkspaceSummary } from './workspace-data';
export type WorkspaceProps = {
  section: string;
  eventId: string;
  active: boolean;
  summary: WorkspaceSummary;
  busy: boolean;
  execute: (path: string, body: object, method?: string) => Promise<boolean>;
};
export type PageData<T> = { items: T[]; nextAfterId: string | null };
export const workspacePath = (id: string, section: string) =>
  `/admin/events/${id}/workspace/${section}`;
export function Frame({
  resource,
  children,
}: {
  resource: { data: unknown; error: string; busy: boolean };
  children: ReactNode;
}) {
  return (
    <Stack spacing={2}>
      {resource.error && <Alert severity="error">{resource.error}</Alert>}
      {!resource.data && !resource.error && resource.busy && (
        <Typography>Загружаем раздел…</Typography>
      )}
      {resource.data ? children : null}
    </Stack>
  );
}
export function More({
  resource,
}: {
  resource: {
    data: { nextAfterId: string | null } | null;
    busy: boolean;
    load: (cursor?: string) => Promise<void>;
  };
}) {
  return resource.data?.nextAfterId ? (
    <Button
      disabled={resource.busy}
      onClick={() => void resource.load(resource.data!.nextAfterId!)}
    >
      Показать ещё
    </Button>
  ) : null;
}
export function Details({ value }: { value: unknown }) {
  return (
    <Box component="details">
      <Typography component="summary" color="text.secondary">
        Технические подробности
      </Typography>
      <Box
        component="pre"
        sx={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          fontSize: 12,
          maxHeight: 320,
          overflow: 'auto',
          p: 1.5,
          bgcolor: 'action.hover',
          borderRadius: 1,
        }}
      >
        {JSON.stringify(value, null, 2)}
      </Box>
    </Box>
  );
}
