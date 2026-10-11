import { useState } from 'react';
import { Alert, Box, Button, Drawer, Typography } from '@mui/material';
import type { Issue, Resolution } from './types';
export function ScenarioHelpPanel({ text, issues, preview }: { text: string; issues: Issue[]; preview: Resolution['preview'] }) {
  const [open, setOpen] = useState(false);
  const content = (
    <>
      <Typography variant="subtitle2">Как заполнить</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {text}
      </Typography>
      {preview && <Box sx={{mt:2}}>
        <Typography variant="subtitle2">Расчёт по настройкам</Typography>
        {preview.blocks.slice(0,3).map(block => <Typography key={block.key} variant="body2" sx={{mt:1}}>{block.title}: {new Date(block.schedule.startsAt).toLocaleString('ru-RU')}{block.requiredServers>0 ? ` · серверов: ${block.requiredServers}` : ' · сервер для каждой попытки'}</Typography>)}
        {preview.blocks.length>3 && <Typography variant="caption">Всего блоков: {preview.blocks.length}. Полный календарь — в разделе «Проверка».</Typography>}
        {preview.registrations?.slice(0,3).map(registration => <Typography key={registration.key} variant="body2" sx={{mt:1}}>Регистрация: {registration.config.opensAt ? new Date(registration.config.opensAt).toLocaleString('ru-RU') : 'сразу'} — {new Date(registration.config.closesAt).toLocaleString('ru-RU')}. {registration.config.capacity === null ? 'Без лимита участников' : `Мест: ${registration.config.capacity}`}</Typography>)}
      </Box>}
      {issues.map((issue, i) => (
        <Alert sx={{ mt: 1 }} key={i} severity={issue.severity}>
          {issue.message}
        </Alert>
      ))}
    </>
  );
  return (
    <>
      <Box
        component="aside"
        sx={{
          display: { xs: 'none', lg: 'block' },
          alignSelf: 'start',
          position: 'sticky',
          top: 24,
          borderLeft: 1,
          borderColor: 'divider',
          pl: 2,
        }}
      >
        {content}
      </Box>
      <Button
        sx={{
          display: { xs: 'inline-flex', lg: 'none' },
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 1100,
        }}
        variant="contained"
        onClick={() => setOpen(true)}
      >
        Пояснения
      </Button>
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 300, maxWidth: '85vw', p: 3 }}>
          <Button onClick={() => setOpen(false)}>Закрыть</Button>
          {content}
        </Box>
      </Drawer>
    </>
  );
}
