import { Box, Button, Stack, Typography } from '@mui/material';
import { Link, useSearchParams } from 'react-router-dom';
import { displayDateTime } from '../../../../../shared/presentation';
import type { WorkspaceSummary } from './workspace-data';

export function WorkspaceOverview({ data, choose }: { data: WorkspaceSummary; choose: (section: string) => void }) {
  const [, setQuery] = useSearchParams();
  const date = (value: string | null | undefined) => displayDateTime(value, data.event.timezone);
  const schedule = data.event.displaySchedule;
  const types: Record<string, string> = { RACE: 'Гонка', PRACTICE: 'Практика', TIME_ATTACK: 'Заезд на время', DUEL: 'Дуэль', TOURNAMENT: 'Турнир' };
  return <Stack spacing={4}>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 3 }}>
      <Fact label="Начало">{date(schedule?.startsAt ?? data.event.startsAt)}</Fact>
      <Fact label="Окончание">{date(schedule ? schedule.endsAt : data.event.endsAt)}</Fact>
      <Fact label="Регистрация">
        {data.activity.hasRegistration ? <><Typography component="span" fontWeight={650}>{data.activity.applications.accepted} допущено</Typography><Typography variant="body2" color="text.secondary">{data.activity.applications.pending} ожидают рассмотрения</Typography></> : 'Без регистрации'}
      </Fact>
      <Fact label="Участники заездов">
        {data.counts.participants ?? '—'}
        <Button size="small" sx={{ display: 'block', px: 0 }} onClick={() => choose('participants')}>Открыть участников →</Button>
      </Fact>
    </Box>
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
        <Typography variant="h6">Программа события</Typography>
        <Button onClick={() => choose('execution')}>Проведение · {data.counts.stages} этапов →</Button>
      </Stack>
      {(data.program ?? []).map(stage => <Box key={stage.key} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(180px,1fr) minmax(180px,1fr) minmax(0,1.5fr)' }, gap: 2, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box>
          <Button sx={{ p: 0, textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => setQuery({ section: 'execution', stage: stage.key })}>{stage.title}</Button>
          <Typography variant="body2" color="text.secondary">{types[stage.type] ?? stage.type}</Typography>
        </Box>
        <Box><Typography variant="body2">{date(stage.startsAt)}</Typography><Typography variant="body2" color="text.secondary">До {date(stage.endsAt)}</Typography></Box>
        <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}><Typography variant="body2">Трасса: {stage.track ?? 'Не указана'}</Typography><Typography variant="body2" color="text.secondary">Машины: {stage.cars.join(', ') || 'Не указаны'}</Typography></Box>
      </Box>)}
      {!data.program?.length && <Typography color="text.secondary" sx={{ mt: 2 }}>Программа события пока не доступна.</Typography>}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Время указано в часовом поясе события: {data.event.timezone || 'не указан'}</Typography>
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
      <Stack spacing={1}>
        <Typography fontWeight={650}>Состояние события</Typography>
        <Typography>{data.event.displayStatus.label}{data.currentStage ? ` · ${data.currentStage.title}` : ''}</Typography>
        {data.nextStage && <Typography variant="body2">Далее: {data.nextStage.title} · {date(data.nextStage.startsAt)}</Typography>}
        {data.stop && <Typography variant="body2">Причина остановки: {data.stop.reason}</Typography>}
        {data.activity.runtime.active > 0 && <Typography variant="body2">Активных запусков: {data.activity.runtime.active}</Typography>}
        {data.activity.runtime.uncertain > 0 && <Typography variant="body2" color="warning.main">Запусков без связи: {data.activity.runtime.uncertain}</Typography>}
        {data.counts.results > 0 && <Button sx={{ alignSelf: 'flex-start', px: 0 }} onClick={() => setQuery({ section: 'results', ...(data.primaryResultId ? { resultId: data.primaryResultId } : {}) })}>Открыть результаты →</Button>}
      </Stack>
      <Stack spacing={1}>
        <Typography fontWeight={650}>О событии</Typography>
        <Typography variant="body2">Автор: {data.metadata.author ? <Link to={`/users?userId=${data.metadata.author.participantId}&eventId=${data.eventId}`}>{data.metadata.author.displayName}</Link> : 'Не сохранён'}</Typography>
        <Typography variant="body2">Создано: {date(data.metadata.createdAt)}</Typography>
        <Typography variant="body2">Опубликовано: {data.metadata.publishedAt ? date(data.metadata.publishedAt) : 'Публикация не зафиксирована'}</Typography>
        <Typography variant="caption" color="text.secondary">Версия {data.version} · Данные на {date(data.observedAt)}</Typography>
      </Stack>
    </Box>
  </Stack>;
}
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <Box><Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>{label}</Typography><Box sx={{ fontSize: 18, fontWeight: 600 }}>{children}</Box></Box>;
}

