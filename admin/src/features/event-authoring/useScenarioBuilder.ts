import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {withRequiredEventPlugins} from '../../../../shared/required-event-plugins';
import { ApiError, apiFetch } from '../../shared/api';
import { getCatalog, publishDraft, resolveDocument, saveDocument } from './api';
import {
  emptyDocument,
  type Catalog,
  type Document,
  type Draft,
  type Resolution,
  type EditRestrictions,
  type Settings,
} from './types';
import { read } from './form-state';
import type { ScenarioBuilderProps } from './ScenarioBuilder';
export function useScenarioBuilder({
  descriptionOnly,
  draftId,
  initialDocument,
  onSaved,
  onPublished,
  edit,
  onEdited,
}: ScenarioBuilderProps) {
  const [document, setDocument] = useState<Document>(initialDocument ?? emptyDocument()),
    [draft, setDraft] = useState<Draft>(),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [organizers, setOrganizers] = useState<{ id: string; name: string }[]>([]),
    [section, setSection] = useState(descriptionOnly ? 'description' : 'program'),
    [editRestrictions, setEditRestrictions] = useState<EditRestrictions>(),
    [resolution, setResolution] = useState<Resolution | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(!!draftId);
  const editing = !!edit,
    editEventId = edit?.eventId,
    editExpectedVersion = edit?.expectedVersion;
  const publishedFromLoad = useEffectEvent((id: string) => onPublished?.(id));
  const pendingPublication = useRef<{ draft: Draft; key: string } | null>(null);
  const [publicationPending, setPublicationPending] = useState(false);
  const uploads = useRef(new Set<string>());
  const revision = useRef(0),
    lock = useRef(false),
    keys = useRef(new Map<string, string>()),
    current = useRef(document);
  const update = (next: Document) => {
    if(!descriptionOnly)next={...next,settings:withRequiredEventPlugins(next.scenarioCode,next.settings)};
    revision.current++;
    current.current = next;
    setDocument(next);
    setResolution(null);
    setNotice('');
  };
  const settings = (next: Settings) => update({ ...document, settings: next });
  const organizerId = String(read(document.settings, 'event.organizerId') ?? '');
  useEffect(() => {
    let alive = true;
    void apiFetch<{ id: string; name: string }[]>('/admin/access/organizers')
      .then((rows) => {
        if (alive) setOrganizers(rows);
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    setCatalog(null);
    void getCatalog(editing ? undefined : organizerId)
      .then((value) => {
        if (value.contractVersion !== 1)
          throw Error('Обновите админку: версия конструктора изменилась');
        if (alive) setCatalog(value);
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [organizerId, editing]);
  useEffect(() => {
    if (!draftId) return;
    let alive = true;
    setLoading(true);
    void apiFetch<Draft>('/admin/event-drafts/' + draftId)
      .then((value) => {
        if (!alive) return;
        if (value.document.contractVersion !== 1) throw Error('Формат черновика не поддерживается');
        setDraft(value);
        if (value.publishedEventId) publishedFromLoad(value.publishedEventId);
        revision.current++;
        const loaded=descriptionOnly?value.document:{...value.document,settings:withRequiredEventPlugins(value.document.scenarioCode,value.document.settings)};
        setDocument(loaded);
        current.current = loaded;
      })
      .catch((e) => {
        if (alive) setError(String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [draftId]);
  useEffect(() => {
    if (loading) return;
    let alive = true;
    const version = revision.current;
    const timer = setTimeout(() => {
      void resolveDocument(
        document,
        version,
        editEventId && editExpectedVersion
          ? { eventId: editEventId, expectedVersion: editExpectedVersion }
          : undefined,
      )
        .then((value) => {
          if (alive && revision.current === value.revision) {
            setResolution(value);
            setEditRestrictions(value.editRestrictions);
          }
        })
        .catch((e) => {
          if (alive) setError(String(e));
        });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [document, loading, editEventId, editExpectedVersion]);
  const descriptor = catalog?.items.find((item) => item.code === document.scenarioCode);
  const requestKey = (name: string, input: unknown) => {
    const fingerprint = JSON.stringify([name, input]);
    let key = keys.current.get(fingerprint);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(fingerprint, key);
    }
    return key;
  };
  async function save(publish: boolean) {
    if (lock.current || loading) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (publish && pendingPublication.current) {
        const pending = pendingPublication.current;
        const result = await publishDraft(pending.draft, pending.key);
        pendingPublication.current = null;
        setPublicationPending(false);
        setDraft({ ...pending.draft, publishedEventId: result.eventId });
        onPublished?.(result.eventId);
        setNotice('Событие опубликовано');
        return;
      }
      const captured = current.current,
        capturedRevision = revision.current;
      if (edit) {
        const checked = await resolveDocument(captured, capturedRevision, edit);
        setResolution(checked);
        if (!checked.canPublish) {
          setSection('review');
          return;
        }
        await apiFetch('/admin/event-authoring/events/' + edit.eventId, {
          method: 'PUT',
          headers: { 'Idempotency-Key': requestKey('edit', [edit, captured]) },
          body: JSON.stringify({ expectedVersion: edit.expectedVersion, document: captured }),
        });
        onEdited?.();
        setNotice('Изменения сохранены');
        return;
      }
      const saved = await saveDocument(
        captured,
        requestKey('save', [draft?.id, draft?.revision, captured]),
        draft,
      );
      setDraft(saved);
      onSaved?.(saved);
      if (publish) {
        const checked = await resolveDocument(captured, capturedRevision);
        setResolution(checked);
        if (!checked.canPublish || revision.current !== capturedRevision) {
          setSection('review');
          return;
        }
        const key = requestKey('publish', [saved.id, saved.revision]);
        pendingPublication.current = { draft: saved, key };
        setPublicationPending(true);
        const result = await publishDraft(saved, key);
        pendingPublication.current = null;
        setPublicationPending(false);
        setDraft({ ...saved, publishedEventId: result.eventId });
        onPublished?.(result.eventId);
        setNotice('Событие опубликовано');
      } else
        setNotice(
          revision.current === capturedRevision
            ? 'Черновик сохранён'
            : 'Сохранена предыдущая версия; есть новые изменения',
        );
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        pendingPublication.current = null;
        setPublicationPending(false);
      }
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Версия изменилась или операция больше недоступна. Введённые данные сохранены в форме; откройте актуальную версию в другой вкладке для сравнения.'
          : e instanceof Error
            ? e.message
            : 'Не удалось сохранить',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return {
    publicationPending,
    editRestrictions,
    document,
    draft,
    catalog,
    organizers,
    section,
    setSection,
    resolution,
    error,
    setError,
    notice,
    busy,
    loading,
    uploads,
    current,
    update,
    settings,
    organizerId,
    descriptor,
    save,
  };
}
