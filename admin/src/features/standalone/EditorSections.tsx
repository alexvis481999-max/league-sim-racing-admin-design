import { useEffect, type ReactNode } from 'react';
import { Box, Button, Stack, Tab, Tabs, Typography } from '@mui/material';

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
}

export function EditorSections({
  sections,
  value,
  onChange,
  dirty,
  actions,
  children,
  inlineActions = false,
}: {
  sections: readonly (readonly [string, string])[];
  value: string;
  onChange(value: string): void;
  dirty: boolean;
  actions: ReactNode;
  children: ReactNode;
  inlineActions?: boolean;
}) {
  useUnsavedChanges(dirty);
  const tabs = <Tabs
        value={value}
        onChange={(_, next) => onChange(next)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Разделы настроек"
        sx={inlineActions ? { flex: 1, minWidth: 0 } : undefined}
      >
        {sections.map(([key, label]) => (
          <Tab
            key={key}
            id={`editor-tab-${key}`}
            aria-controls={`editor-panel-${key}`}
            value={key}
            label={label}
          />
        ))}
      </Tabs>;
  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        gap={2}
        alignItems="center"
        flexWrap={inlineActions ? 'nowrap' : 'wrap'}
        sx={{ position: 'sticky', top: { xs: 72, md: 0 }, zIndex: 2, bgcolor: 'background.paper', py: 1 }}
      >
        {inlineActions ? tabs : <Typography variant="body2" color="text.secondary" role="status" sx={{ flex: 1 }}>
          {dirty ? 'Есть несохранённые изменения' : 'Изменений нет'}
        </Typography>}
        <Box sx={{ flexShrink: 0 }}>{actions}</Box>
      </Stack>
      {!inlineActions && tabs}
      {children}
    </Stack>
  );
}

export function EditorPanel({
  id,
  active,
  children,
}: {
  id: string;
  active: string;
  children: ReactNode;
}) {
  return (
    <Box
      role="tabpanel"
      id={`editor-panel-${id}`}
      aria-labelledby={`editor-tab-${id}`}
      hidden={active !== id}
      sx={{ minWidth: 0 }}
    >
      {children}
    </Box>
  );
}

export function ReviewIssues({
  issues,
  onSelect,
}: {
  issues: { section: string; message: string }[];
  onSelect(section: string): void;
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1" fontWeight={700}>
        {issues.length ? 'Нужно исправить' : 'Основные настройки заполнены'}
      </Typography>
      {issues.map((issue, index) => (
        <Button
          key={index}
          color="error"
          onClick={() => onSelect(issue.section)}
          sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
        >
          {issue.message}
        </Button>
      ))}
      {!issues.length && (
        <Typography variant="body2" color="text.secondary">
          Доступность контента и ограничения сервера будут проверены при сохранении.
        </Typography>
      )}
    </Stack>
  );
}
