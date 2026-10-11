import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { normalizeRichTextAssetUrls } from '../../../../../shared/asset-url';
import { normalizeEventCardStudioConfig } from '../../card-studio/eventCardConfig';
import { getApiBaseUrl } from '../../../shared/api';
import type { WorkspaceSummary } from './workspace-data';

export function WorkspaceMaterials({ data }: { data: WorkspaceSummary }) {
  const event = data.event,
    cover = event.presentation?.coverUrl,
    site = String(import.meta.env.VITE_SITE_URL).replace(/\/$/, '');
  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">На сайте</Typography>
        {event.status !== 'DRAFT' && (
          <Button
            component="a"
            href={`${site}/events/${data.eventId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть событие ↗
          </Button>
        )}
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,3fr) minmax(220px,2fr)' },
          gap: 4,
          alignItems: 'start',
        }}
      >
        <SiteCardPreview data={data} />
        <Stack spacing={2.5}>
          <Meta label="Название">{event.title}</Meta>
          <Meta label="Подзаголовок">{event.presentation?.subtitle || 'Не добавлен'}</Meta>
          <Meta label="Исходная обложка">
            {cover ? (
              <Box
                component="a"
                href={new URL(cover, getApiBaseUrl()).href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Box
                  component="img"
                  src={new URL(cover, getApiBaseUrl()).href}
                  alt="Обложка события"
                  sx={{ width: 140, height: 90, objectFit: 'cover', borderRadius: 1, mt: 0.5 }}
                />
              </Box>
            ) : (
              'Не добавлена'
            )}
          </Meta>
        </Stack>
      </Box>
      <Box sx={{ maxWidth: 800, borderTop: '1px solid', borderColor: 'divider', pt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Описание
        </Typography>
        {event.description ? (
          <Box
            sx={{
              lineHeight: 1.7,
              overflowWrap: 'anywhere',
              '& img': { maxWidth: '100%', height: 'auto' },
              '& table': { display: 'block', overflowX: 'auto' },
            }}
            dangerouslySetInnerHTML={{ __html: normalizeRichTextAssetUrls(event.description) }}
          />
        ) : (
          <Empty>Описание не добавлено</Empty>
        )}
      </Box>
    </Stack>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ fontSize: 14, fontWeight: 500, overflowWrap: 'anywhere' }}>{children}</Box>
    </Box>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <Typography color="text.secondary" sx={{ py: 3 }}>
      {children}
    </Typography>
  );
}

/** The iframe runs the public renderer and stylesheet; no duplicate card markup in admin. */
function SiteCardPreview({ data }: { data: WorkspaceSummary }) {
  const frame = useRef<HTMLIFrameElement>(null),
    [height, setHeight] = useState(360),
    [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const site = String(import.meta.env.VITE_SITE_URL).replace(/\/$/, '');
  const send = useCallback(
    () =>
      frame.current?.contentWindow?.postMessage(
        {
          type: 'lsr-event-card-preview',
          source: {},
          modes: [],
          config: {
            ...normalizeEventCardStudioConfig(data.event.presentation?.cardAppearance),
            previewTheme: theme,
          },
          publicEvent: data.event,
        },
        new URL(site).origin,
      ),
    [data.event, site, theme],
  );
  useEffect(() => {
    send();
  }, [send]);
  useEffect(() => {
    const receive = (e: MessageEvent) => {
      if (e.origin !== new URL(site).origin || e.source !== frame.current?.contentWindow || !e.data)
        return;
      if (e.data.type === 'lsr-event-card-preview-ready') {
        setReady(true);
        send();
      }
      if (
        e.data.type === 'lsr-event-card-preview-size' &&
        typeof e.data.height === 'number' &&
        Number.isFinite(e.data.height)
      )
        setHeight(Math.max(200, Math.min(1400, e.data.height)));
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [send, site]);
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary">
          Карточка в списке событий
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={theme}
          onChange={(_, v) => v && setTheme(v)}
          aria-label="Тема предпросмотра"
        >
          <ToggleButton value="dark">Тёмная</ToggleButton>
          <ToggleButton value="light">Светлая</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {!ready && (
        <Typography variant="body2" color="text.secondary">
          Ожидаем предпросмотр с сайта…
        </Typography>
      )}
      <Box
        component="iframe"
        ref={frame}
        src={`${site}/event-card-preview?isolated=1`}
        title="Сохранённая карточка события на сайте"
        onLoad={send}
        sx={{
          display: 'block',
          width: '100%',
          height,
          border: 0,
          borderRadius: 1,
          bgcolor: theme === 'dark' ? '#10141c' : '#f4f7fa',
        }}
      />
    </Stack>
  );
}
