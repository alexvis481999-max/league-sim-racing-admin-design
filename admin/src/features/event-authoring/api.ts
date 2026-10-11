import { apiFetch } from '../../shared/api';
import type { Catalog, Document, Draft, Resolution } from './types';
export const getCatalog = (organizerId?: string) =>
  apiFetch<Catalog>(
    '/admin/event-authoring/catalog' +
      (organizerId ? '?organizerId=' + encodeURIComponent(organizerId) : ''),
  );
export const resolveDocument = (
  document: Document,
  revision: number,
  edit?: { eventId: string; expectedVersion: string },
) =>
  apiFetch<Resolution>('/admin/event-authoring/resolve', {
    method: 'POST',
    body: JSON.stringify({ document, revision, edit }),
  });
export const saveDocument = (document: Document, key: string, draft?: Draft) =>
  apiFetch<Draft>('/admin/event-drafts' + (draft ? '/' + draft.id : ''), {
    method: draft ? 'PUT' : 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ document, ...(draft ? { expectedVersion: draft.revision } : {}) }),
  });
export const publishDraft = (draft: Draft, key: string) =>
  apiFetch<{ eventId: string }>(`/admin/event-drafts/${draft.id}/publish`, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ expectedVersion: draft.revision }),
  });
