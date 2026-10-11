import { saveDocument } from '../../../features/event-authoring/api';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingBlock, Panel, usePageChrome } from '../../../ui/v16';
import { ScenarioBuilder } from '../../../features/event-authoring/ScenarioBuilder';
import type { Document, Settings } from '../../../features/event-authoring/types';
import { apiFetch } from '../../../shared/api';
export function EventAuthoringPage() {
  const navigate = useNavigate(),
    [params] = useSearchParams(),
    [initial, setInitial] = useState<Document>(),
    [error, setError] = useState('');
  const cloneKey = useRef(crypto.randomUUID());
  const clone = params.get('clone'),
    draft = params.get('draft');
  usePageChrome({ back: { label: 'Назад', to: '/events' }, crumbs: [{ label: 'События', to: '/events' }, { label: clone ? 'Копия события' : draft ? 'Черновик' : 'Создать событие' }] });
  useEffect(() => {
    if (!clone) return;
    let alive = true;
    void apiFetch<{ scenarioCode: string; settings: Settings }>(
      `/admin/events/${clone}/copy-template`,
    )
      .then(async (source) => {
        const document: Document = {
          contractVersion: 1,
          scenarioCode: source.scenarioCode,
          settings: source.settings,
          pendingImages: [],
        };
        const saved = await saveDocument(document, cloneKey.current);
        if (alive) {
          setInitial(document);
          navigate('/events/new?draft=' + saved.id, { replace: true });
        }
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [clone]);
  if (error) return <ErrorState error={error} />;
  if (clone && !initial) return <Panel><LoadingBlock rows={5} label="Подготавливаем копию" /></Panel>;
  return (
    <ScenarioBuilder
      key={draft ?? clone ?? 'new'}
      draftId={draft ?? undefined}
      initialDocument={initial}
      onPublished={(id) => navigate('/events/' + id)}
      onSaved={(row) => {
        if (!draft) window.history.replaceState(null, '', '/events/new?draft=' + row.id);
      }}
    />
  );
}
