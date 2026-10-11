import {useRealtimeRefresh} from '../../shared/realtime';
import { organizerIdsFor, hasPlatformPermission } from '../../shared/access';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip,
  FormControl, FormControlLabel, InputLabel, MenuItem, Paper,
  Radio, RadioGroup, Select, Stack, Switch, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs,
  TextField, Typography, type SelectChangeEvent, type TextFieldProps,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ImageIcon from '@mui/icons-material/Image';
import { ArrowDownward, ArrowUpward } from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch, getContentAssetUrl, jsonBody } from '../../shared/api';
import { useAsyncState } from '../../shared/asyncState';
import { formatDate, slugify, uuid } from '../../shared/format';
import { EmptyTableRow, RowActions, openableRow } from '../../shared/table';
import { BackAction, CreateAction, Page, PageActions, RefreshAction, Section, StatusAlert } from '../../shared/ui';
import type {
  AccessOrganizer, AdminAccess, ContentRevisionPlacement, PublicationAction,
  PublicationDetails, PublicationPlacementCode,
} from '../../shared/types';
import { PhotoCatalogDialog, RichDescriptionEditor, type PhotoSelection } from '../../shared/RichContent';
import { ContentAppearancePreview, ContentAppearanceStudio } from './ContentAppearanceStudio';
import {
  defaultContentAppearance, normalizeContentAppearance, type ContentSurfaceKind,
} from './contentAppearance';
import {
  emptyForm, isSliderPlacement, placementPayload, validatePublication,
  type PlacementForm, type PublicationForm, type PublicationValidation,
} from './publicationForm';

const placementDefinitions: Array<{
  code: PublicationPlacementCode; label: string; group: string; surface: ContentSurfaceKind; supportsActions: boolean;
}> = [
  { code: 'home.feed', label: 'Новостная лента', group: 'Главная страница', surface: 'card', supportsActions: false },
  { code: 'home.hero', label: 'Большой слайдер', group: 'Главная страница', surface: 'slider', supportsActions: true },
  { code: 'home.promo', label: 'Дополнительный слайдер', group: 'Главная страница', surface: 'slider', supportsActions: true },
  { code: 'touge.feed', label: 'Новостная лента', group: 'Touge', surface: 'card', supportsActions: false },
  { code: 'touge.featured_news', label: 'Главный блок новостей', group: 'Touge', surface: 'slider', supportsActions: true },
];

const kindOptions = [
  ['news', 'Новость'], ['announcement', 'Анонс'], ['result', 'Результаты'],
  ['update', 'Обновление'], ['promo', 'Промо'],
] as const;

export function SitePage({ access }: { access: AdminAccess }) {
  const location = useLocation();
  const navigate = useNavigate();
  const editorPath = location.pathname.startsWith('/site/') ? location.pathname.slice('/site/'.length).split('/')[0] : '';
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<PublicationDetails[]>([]);
  const [organizers, setOrganizers] = useState<AccessOrganizer[]>([]);
  const [selected, setSelected] = useState<PublicationDetails | null>(null);
  const [form, setForm] = useState<PublicationForm>(() => emptyForm(organizerIdsFor(access, 'news.write.scoped', 'news.publish.scoped')[0] ?? ''));
  const [state, run, setState] = useAsyncState<unknown>();
  const initializedRef = useRef(false);
  const initializedEditorRef = useRef('');
  const canChoosePlatformOwner = hasPlatformPermission(access, 'news.write.all', 'catalog.manage.all');

  const load = useCallback(async () => {
    const data = await run(async () => { const all: PublicationDetails[] = []; let after: string | null = null; do { const page: { items: PublicationDetails[]; nextAfterId: string | null } = await apiFetch(`/admin/publications?limit=100${after ? `&afterId=${after}` : ''}`); all.push(...page.items); after = page.nextAfterId; } while (after); return all; }) as PublicationDetails[];
    setItems(data);
  }, [run]);

  useRealtimeRefresh(['publications'],()=>{if(tab===0)return load();});
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void load().catch(() => undefined);
    void apiFetch<AccessOrganizer[]>('/admin/access/organizers').then(setOrganizers).catch(() => setOrganizers([]));
  }, [load]);

  useEffect(() => {
    if (!editorPath || initializedEditorRef.current === editorPath) return;
    if (editorPath === 'new') {
      setSelected(null);
      setForm(emptyForm(organizerIdsFor(access, 'news.write.scoped', 'news.publish.scoped')[0] ?? ''));
      initializedEditorRef.current = editorPath;
      return;
    }
    const item = items.find(({ entry }) => entry.id === editorPath);
    if (!item) return;
    setSelected(item);
    setForm(publicationToForm(item));
    initializedEditorRef.current = editorPath;
  }, [access.grants, editorPath, items]);

  function createPublication() {
    setSelected(null);
    setForm(emptyForm(organizerIdsFor(access, 'news.write.scoped', 'news.publish.scoped')[0] ?? ''));
    initializedEditorRef.current = 'new';
    navigate('/site/new');
  }

  function editPublication(item: PublicationDetails) {
    setSelected(item);
    setForm(publicationToForm(item));
    initializedEditorRef.current = item.entry.id;
    navigate(`/site/${item.entry.id}`);
  }

  async function savePublication(mode: 'draft' | 'publish') {
    const validation = validatePublication(form, selected && ['published', 'scheduled'].includes(selected.entry.status) ? 'publish' : mode);
    if (!validation.valid) {
      setState((current) => ({ ...current, error: validation.blockers.join('. '), done: false }));
      return;
    }
    const activePlacements = placementDefinitions.filter(({ code }) => form.placements[code].enabled);

    const startsAt = form.timingMode === 'now' ? '' : form.publishStartsAt;
    const endsAt = form.timingMode === 'period' ? form.publishEndsAt : '';
    const publication = {
      slug: selected?.entry.slug ?? contentSlug(form.title), kind: form.publicationKind,
      ownerType: form.accessOrganizerId ? 'organizer' : 'platform', ownerId: form.accessOrganizerId || null,
      title: form.title.trim(), summary: form.summary.trim(), body: form.body.trim(), coverAssetId: form.coverAssetId || null,
      startsAt: startsAt ? new Date(startsAt).toISOString() : selected?.entry.publishedAt ?? null,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      placements: activePlacements.map(({ code }) => { const { sortOrder: _sort, startsAt: _start, endsAt: _end, ...p } = placementPayload(code, form.placements[code], startsAt, endsAt); return p; }),
    };
    const created = await run(() => selected
      ? apiFetch<PublicationDetails>(`/admin/publications/${selected.entry.id}`, publicationCommand({ expectedVersion: selected.version, publication }, 'PATCH'))
      : apiFetch<PublicationDetails>('/admin/publications', publicationCommand(publication))) as PublicationDetails;
    setSelected(created);
    if (mode === 'publish' && !['published', 'scheduled'].includes(created.entry.status)) {
      const scheduled = startsAt && new Date(startsAt).getTime() > Date.now();
      const updated = await run(() => apiFetch<PublicationDetails>(`/admin/publications/${created.entry.id}/${scheduled ? 'schedule' : 'publish'}`, publicationCommand({ expectedVersion: created.version, ...(scheduled ? { startsAt: new Date(startsAt).toISOString() } : {}), endsAt: publication.endsAt }))) as PublicationDetails;
      setSelected(updated);
    }
    initializedEditorRef.current = '';
    navigate('/site');
    await load();
  }

  async function unpublishPublication() {
    if (!selected) return;
    await run(() => apiFetch(`/admin/publications/${selected.entry.id}/unpublish`, publicationCommand({ expectedVersion: selected.version })));
    initializedEditorRef.current = '';
    navigate('/site');
    await load();
  }

  async function deletePublication(item: PublicationDetails) {
    await run(() => apiFetch(`/admin/publications/${item.entry.id}`, publicationCommand({ expectedVersion: item.version }, 'DELETE')));
    await load();
  }

  const draftValidation = validatePublication(form, 'draft');
  const publishValidation = validatePublication(form, 'publish');

  if (editorPath) {
    return (
      <Page
        title={selected ? 'Редактирование публикации' : 'Новая публикация'}
        subtitle="Текст, места размещения, сроки и внешний вид."
        back={<BackAction label="К публикациям" onClick={() => { initializedEditorRef.current = ''; navigate('/site'); }}/> }
      >
        <Stack spacing={2}>
          <PublicationEditor ownerLocked={!!selected} form={form} setForm={setForm} organizers={canChoosePlatformOwner ? organizers : organizers.filter(item => organizerIdsFor(access, 'news.write.scoped', 'news.publish.scoped').includes(item.id))} canChoosePlatformOwner={canChoosePlatformOwner} validation={publishValidation} />
          {!publishValidation.valid ? <PublicationValidationAlert validation={publishValidation} /> : null}
          <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {selected?.entry.status === 'published' || selected?.entry.status === 'scheduled' ? <Button color="warning" disabled={state.loading} onClick={unpublishPublication}>Снять с публикации</Button> : null}
            <Button disabled={!draftValidation.valid || state.loading || selected?.allowedActions?.edit === false} onClick={() => savePublication('draft')}>{selected && ['published', 'scheduled'].includes(selected.entry.status) ? 'Сохранить изменения' : 'Сохранить черновик'}</Button>
            {(!selected || !['published', 'scheduled'].includes(selected.entry.status)) && <Button variant="contained" disabled={!publishValidation.valid || state.loading || selected?.allowedActions?.publish === false} onClick={() => savePublication('publish')}>Опубликовать</Button>}
          </Paper>
          <StatusAlert state={state} />
        </Stack>
      </Page>
    );
  }

  return (
    <Page
      title="Публикации"
      subtitle="Один материал для новостных лент, главного слайдера и раздела Touge."
      actions={<PageActions><RefreshAction onClick={load} loading={state.loading} />{tab === 0 ? <CreateAction label="Создать публикацию" onClick={createPublication} /> : null}</PageActions>}
    >
      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab label="Публикации" />
        {hasPlatformPermission(access, 'publications.reorder.all') && <Tab label="Порядок слайдов" />}
      </Tabs>
      {tab === 0 ? (
        <Section embedded>
          <TableContainer><PublicationTable rows={items} onEdit={editPublication} onDelete={deletePublication} /></TableContainer>
        </Section>
      ) : <PlacementOrder items={items} onSaved={load} />}
      <StatusAlert state={state} />
    </Page>
  );
}

function PublicationValidationAlert({ validation }: { validation: PublicationValidation }) {
  return (
    <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
      <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Пока нельзя опубликовать</Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {validation.blockers.map((message) => <li key={message}>{message}</li>)}
      </Box>
    </Alert>
  );
}

function PublicationEditor({ ownerLocked, form, setForm, organizers, canChoosePlatformOwner, validation }: {
  ownerLocked: boolean; form: PublicationForm; setForm: React.Dispatch<React.SetStateAction<PublicationForm>>;
  organizers: AccessOrganizer[]; canChoosePlatformOwner: boolean; validation: PublicationValidation;
}) {
  const [expandedPlacement, setExpandedPlacement] = useState<PublicationPlacementCode | null>(null);
  const [appearanceExpanded, setAppearanceExpanded] = useState<Partial<Record<PublicationPlacementCode, boolean>>>({});
  const update = (patch: Partial<PublicationForm>) => setForm((current) => ({ ...current, ...patch }));
  const updatePlacement = (code: PublicationPlacementCode, patch: Partial<PlacementForm>) => setForm((current) => ({
    ...current, placements: { ...current.placements, [code]: { ...current.placements[code], ...patch } },
  }));
  const groups = [...new Set(placementDefinitions.map((item) => item.group))];

  return (
    <Stack spacing={2.5} sx={{ pt: 1 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' }, gap: 1.5 }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Организатор</InputLabel>
          <Select disabled={ownerLocked} label="Организатор" value={form.accessOrganizerId} onChange={(event: SelectChangeEvent) => update({ accessOrganizerId: event.target.value })}>
            {canChoosePlatformOwner ? <MenuItem value="">League Sim Racing</MenuItem> : null}
            {organizers.map((item) => <MenuItem value={item.id} key={item.id}>{item.name}{item.code ? ` (${item.code})` : ''}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth>
          <InputLabel>Тип</InputLabel>
          <Select label="Тип" value={form.publicationKind} onChange={(event: SelectChangeEvent) => update({ publicationKind: event.target.value })}>
            {kindOptions.map(([value, label]) => <MenuItem value={value} key={value}>{label}</MenuItem>)}
          </Select>
        </FormControl>
        <BufferedTextField
          required
          label="Заголовок"
          value={form.title}
          onValueChange={(title) => update({ title })}
          error={Boolean(validation.fieldErrors.title)}
          helperText={validation.fieldErrors.title}
          fullWidth
          sx={{ gridColumn: '1 / -1' }}
        />
      </Box>
      <BufferedTextField
        required
        label="Краткое описание"
        value={form.summary}
        onValueChange={(summary) => update({ summary })}
        error={Boolean(validation.fieldErrors.summary)}
        helperText={validation.fieldErrors.summary}
        multiline
        minRows={2}
      />
      <PublicationImageField assetId={form.coverAssetId} url={form.coverUrl} title="Основное изображение" ownerOrganizerId={form.accessOrganizerId} onChange={(photo) => update({ coverAssetId: photo?.assetId ?? '', coverUrl: photo?.url ?? '', coverTitle: photo?.title ?? '' })} />
      {form.publicationKind === 'promo'
        ? <BufferedTextField label="Текст (необязательно)" value={form.body} onValueChange={(body) => update({ body })} multiline minRows={4} />
        : <Box sx={{ border: '1px solid', borderColor: validation.fieldErrors.body ? 'error.main' : 'divider', borderRadius: 1, p: 1 }}>
            <RichDescriptionEditor value={form.body} onChange={(body) => update({ body })} ownerOrganizerId={form.accessOrganizerId} gameCode="" />
            {validation.fieldErrors.body ? <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.75, px: 0.5 }}>{validation.fieldErrors.body}</Typography> : null}
          </Box>}

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 850 }}>Размещения</Typography>
        <Typography variant="body2" color={validation.fieldErrors.placements ? 'error' : 'text.secondary'}>
          {validation.fieldErrors.placements || 'Выберите блоки сайта. Каждый блок можно оформить отдельно.'}
        </Typography>
        {validation.fieldErrors.actions ? <Typography variant="body2" color="error">{validation.fieldErrors.actions}</Typography> : null}
      </Box>
      {groups.map((group) => (
        <Paper variant="outlined" key={group} sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 850 }}>{group}</Typography>
          <Stack spacing={1}>
            {placementDefinitions.filter((item) => item.group === group).map((definition) => {
              const placement = form.placements[definition.code];
              return (
                <Accordion
                  key={definition.code}
                  expanded={placement.enabled && expandedPlacement === definition.code}
                  onChange={(_, expanded) => {
                    if (placement.enabled) setExpandedPlacement(expanded ? definition.code : null);
                  }}
                  slotProps={{ transition: { unmountOnExit: true } }}
                  disableGutters
                  elevation={0}
                >
                  <AccordionSummary expandIcon={placement.enabled ? <ExpandMoreIcon /> : null}>
                    <FormControlLabel
                      control={<Switch
                        checked={placement.enabled}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(_, enabled) => {
                          updatePlacement(definition.code, { enabled });
                          setExpandedPlacement((current) => enabled ? definition.code : current === definition.code ? null : current);
                        }}
                      />}
                      label={definition.label}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1.5}>
                      {!appearanceExpanded[definition.code] ? (
                        <ContentAppearancePreview
                          placementCode={definition.code}
                          appearance={placement.customized ? placement.appearance : defaultContentAppearance}
                          image={placementPreviewImage(definition.code, placement.customized ? placement.imageUrl : '', form.coverUrl)}
                          title={placement.customized && placement.titleOverride || form.title}
                          summary={placement.customized && placement.summaryOverride || form.summary}
                          eyebrow={placement.customized && placement.eyebrowOverride || publicationKindLabel(form.publicationKind)}
                          actions={placement.customized ? placement.actions : []}
                        />
                      ) : null}
                      <Accordion
                        expanded={Boolean(appearanceExpanded[definition.code])}
                        onChange={(_, expanded) => {
                          setAppearanceExpanded(current => ({ ...current, [definition.code]: expanded }));
                          if (expanded && !placement.customized) updatePlacement(definition.code, { customized: true });
                        }}
                        slotProps={{ transition: { unmountOnExit: true } }}
                        disableGutters
                        elevation={0}
                        variant="outlined"
                        sx={{ '&::before': { display: 'none' } }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography sx={{ fontWeight: 800 }}>Дополнительные настройки отображения</Typography>
                              {placement.customized ? <Chip size="small" color="primary" label="Настроено отдельно" /> : null}
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              Переопределить текст, изображение, кнопки и оформление только для этого блока.
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Stack spacing={1.5}>
                        <Button onClick={() => {
                          updatePlacement(definition.code, { customized: false });
                          setAppearanceExpanded(current => ({ ...current, [definition.code]: false }));
                        }}>Использовать общее оформление</Button>
                        <BufferedTextField label="Заголовок для этого блока" value={placement.titleOverride} placeholder={form.title} onValueChange={(titleOverride) => updatePlacement(definition.code, { titleOverride })} />
                        <BufferedTextField label="Описание для этого блока" value={placement.summaryOverride} placeholder={form.summary} onValueChange={(summaryOverride) => updatePlacement(definition.code, { summaryOverride })} multiline minRows={2} />
                        <BufferedTextField label="Рубрика над заголовком" value={placement.eyebrowOverride} onValueChange={(eyebrowOverride) => updatePlacement(definition.code, { eyebrowOverride })} />
                        <PublicationImageField assetId={placement.imageAssetId} url={placement.imageUrl} title="Отдельное изображение" ownerOrganizerId={form.accessOrganizerId} onChange={(photo) => updatePlacement(definition.code, { imageAssetId: photo?.assetId ?? '', imageUrl: photo?.url ?? '', imageTitle: photo?.title ?? '' })} />
                        {definition.supportsActions ? <ActionEditor code={definition.code} actions={placement.actions} onChange={(actions) => updatePlacement(definition.code, { actions })} /> : null}
                        <ContentAppearanceStudio
                          value={placement.appearance}
                          onChange={(appearance) => updatePlacement(definition.code, { appearance })}
                          placementCode={definition.code}
                          image={placementPreviewImage(definition.code, placement.imageUrl, form.coverUrl)}
                          title={placement.titleOverride || form.title}
                          summary={placement.summaryOverride || form.summary}
                          eyebrow={placement.eyebrowOverride || publicationKindLabel(form.publicationKind)}
                          actions={placement.actions}
                          surfaces={[definition.surface]}
                        />
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Stack>
        </Paper>
      ))}
      <PublicationTimingFields form={form} update={update} validation={validation} />
    </Stack>
  );
}

function PublicationTimingFields({ form, update, validation }: {
  form: PublicationForm;
  update: (patch: Partial<PublicationForm>) => void;
  validation: PublicationValidation;
}) {
  return <Paper variant="outlined" sx={{ p: 1.5 }}>
    <Typography variant="subtitle2" sx={{ fontWeight: 850, mb: 0.5 }}>Когда показывать публикацию</Typography>
    <RadioGroup value={form.timingMode} onChange={(event) => update({ timingMode: event.target.value as PublicationForm['timingMode'] })}>
      <FormControlLabel value="now" control={<Radio />} label="Сразу и бессрочно" />
      <FormControlLabel value="scheduled" control={<Radio />} label="С указанной даты и бессрочно" />
      <FormControlLabel value="period" control={<Radio />} label="В указанный период" />
    </RadioGroup>
    {form.timingMode !== 'now' ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: form.timingMode === 'period' ? 'repeat(2,minmax(0,1fr))' : '1fr' }, gap: 1.5, mt: 1 }}>
      <TextField size="small" type="datetime-local" label="Начало публикации" value={form.publishStartsAt} onChange={(event) => update({ publishStartsAt: event.target.value })} error={Boolean(validation.fieldErrors.scheduledPublishAt)} helperText={validation.fieldErrors.scheduledPublishAt} InputLabelProps={{ shrink: true }} />
      {form.timingMode === 'period' ? <TextField size="small" type="datetime-local" label="Окончание публикации" value={form.publishEndsAt} onChange={(event) => update({ publishEndsAt: event.target.value })} error={Boolean(validation.fieldErrors.sliderEndsAt)} helperText={validation.fieldErrors.sliderEndsAt} InputLabelProps={{ shrink: true }} /> : null}
    </Box> : null}
    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
      {form.timingMode === 'now' && 'Публикация появится сразу и будет доступна, пока вы её не снимете.'}
      {form.timingMode === 'scheduled' && 'Публикация появится автоматически в указанный момент и останется доступной.'}
      {form.timingMode === 'period' && 'Публикация будет видна только между датами начала и окончания.'}
    </Typography>
  </Paper>;
}

function ActionEditor({ code, actions, onChange }: { code: PublicationPlacementCode; actions: PublicationAction[]; onChange: (actions: PublicationAction[]) => void }) {
  const maximum = code === 'home.hero' ? 2 : 1;
  const roles: PublicationAction['role'][] = maximum === 2 ? ['primary', 'secondary'] : ['primary'];
  const update = (role: PublicationAction['role'], patch: Partial<PublicationAction>) => {
    const current = actions.find((item) => item.role === role) ?? { role, label: '', url: '', newTab: false };
    onChange([...actions.filter((item) => item.role !== role), { ...current, ...patch }]);
  };
  return <Stack spacing={1}><Typography variant="subtitle2">Кнопки</Typography>{roles.map((role) => {
    const action = actions.find((item) => item.role === role);
    const labelMissing = Boolean(action?.url.trim()) && !action?.label.trim();
    const urlMissing = Boolean(action?.label.trim()) && !action?.url.trim();
    return <Box key={role} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr auto' }, gap: 1, alignItems: 'center' }}>
      <BufferedTextField size="small" label={role === 'primary' ? 'Основная кнопка' : 'Дополнительная кнопка'} value={action?.label ?? ''} onValueChange={(label) => update(role, { label })} error={labelMissing} helperText={labelMissing ? 'Укажите текст кнопки' : undefined} />
      <BufferedTextField size="small" label="Ссылка" value={action?.url ?? ''} onValueChange={(url) => update(role, { url })} error={urlMissing} helperText={urlMissing ? 'Укажите ссылку' : undefined} />
      <FormControlLabel control={<Switch checked={action?.newTab ?? false} onChange={(_, newTab) => update(role, { newTab })} />} label="Новая вкладка" />
    </Box>;
  })}</Stack>;
}

type BufferedTextFieldProps = Omit<TextFieldProps, 'value' | 'defaultValue' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
};

function BufferedTextField({ value, onValueChange, onBlur, ...props }: BufferedTextFieldProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  return (
    <TextField
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        if (draft !== value) onValueChange(draft);
        onBlur?.(event);
      }}
    />
  );
}

function PublicationImageField({ assetId, url, title, ownerOrganizerId, onChange }: {
  assetId: string; url: string; title: string; ownerOrganizerId: string; onChange: (photo: PhotoSelection | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return <Paper variant="outlined" sx={{ p: 1.5 }}><Stack spacing={1}>
    <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography variant="subtitle2">{title}</Typography><Stack direction="row" spacing={1}>{assetId ? <Button size="small" onClick={() => onChange(null)}>Убрать</Button> : null}<Button size="small" startIcon={<ImageIcon />} variant="outlined" onClick={() => setOpen(true)}>Выбрать</Button></Stack></Stack>
    {url ? <Box component="img" src={url} alt="" sx={{ width: '100%', maxHeight: 260, objectFit: 'cover' }} /> : <Typography variant="body2" color="text.secondary">Изображение не выбрано.</Typography>}
  </Stack><PhotoCatalogDialog open={open} title={title} ownerOrganizerId={ownerOrganizerId} gameCode="" onClose={() => setOpen(false)} onSelect={(photo) => { onChange(photo); setOpen(false); }} /></Paper>;
}

function PublicationTable({ rows, onEdit, onDelete }: { rows: PublicationDetails[]; onEdit: (item: PublicationDetails) => void; onDelete: (item: PublicationDetails) => void }) {
  return <Table size="small"><TableHead><TableRow><TableCell>Публикация</TableCell><TableCell>Тип</TableCell><TableCell>Размещения</TableCell><TableCell>Статус</TableCell><TableCell>Публикация</TableCell><TableCell align="right">Действия</TableCell></TableRow></TableHead><TableBody>
    {rows.map((item) => <TableRow hover key={item.entry.id} {...openableRow(()=>onEdit(item))}><TableCell><Typography sx={{ fontWeight: 750 }}>{item.revision.title || item.entry.slug}</Typography><Typography variant="caption" color="text.secondary">{item.entry.slug}</Typography></TableCell><TableCell>{kindOptions.find(([value]) => value === item.entry.publicationKind)?.[1] ?? item.entry.publicationKind}</TableCell><TableCell><Stack direction="row" flexWrap="wrap" gap={0.5}>{item.placements.map((placement) => <Chip size="small" variant="outlined" key={placement.placementCode} label={placementDefinitions.find((definition) => definition.code === placement.placementCode)?.label ?? placement.placementCode} />)}</Stack></TableCell><TableCell><Chip size="small" label={publicationStatusLabel(item)} /></TableCell><TableCell>{formatDate(item.entry.scheduledPublishAt ?? item.entry.publishedAt)}</TableCell><TableCell align="right"><RowActions><Button size="small" onClick={() => onEdit(item)}>Редактировать</Button><Button size="small" color="error" onClick={() => onDelete(item)}>Удалить</Button></RowActions></TableCell></TableRow>)}
    {!rows.length ? <EmptyTableRow colSpan={6} label="Публикаций пока нет." /> : null}
  </TableBody></Table>;
}

function PlacementOrder({ items, onSaved }: { items: PublicationDetails[]; onSaved: () => Promise<void> }) {
  const sliderDefinitions = placementDefinitions.filter(({ code }) => isSliderPlacement(code));
  const [orders, setOrders] = useState<Record<PublicationPlacementCode, string[]>>(() => buildOrders(items));
  const [versions, setVersions] = useState<Partial<Record<PublicationPlacementCode, number>>>({});
  const [orderError, setOrderError] = useState('');
  useEffect(() => { let active = true; void Promise.all(placementDefinitions.filter(p => isSliderPlacement(p.code)).map(async p => ({ code: p.code, order: await apiFetch<{ ids: string[]; version: number }>(`/admin/publications/placements/${p.code}/order`) }))).then(rows => { if (!active) return; setOrders(current => ({ ...current, ...Object.fromEntries(rows.map(r => [r.code, r.order.ids])) })); setVersions(Object.fromEntries(rows.map(r => [r.code, r.order.version]))); }).catch(e => { if (active) setOrderError(String(e)); }); return () => { active = false; }; }, [items]);
  const move = (code: PublicationPlacementCode, index: number, direction: -1 | 1) => setOrders((current) => {
    const next = [...current[code]]; const target = index + direction;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return { ...current, [code]: next };
  });
  const byId = useMemo(() => new Map(items.map((item) => [item.entry.id, item])), [items]);
  const save = async (code: PublicationPlacementCode) => { try { await apiFetch(`/admin/publications/placements/${code}/order`, publicationCommand({ expectedVersion: versions[code], ids: orders[code] })); setOrderError(''); await onSaved(); } catch (e) { setOrderError(String(e)); } };
  return <Stack spacing={2}>{orderError && <Alert severity="error">{orderError}</Alert>}{sliderDefinitions.map((definition) => <Section title={`${definition.group} · ${definition.label}`} key={definition.code}><Stack spacing={0.75}>{orders[definition.code].map((id, index) => <Paper variant="outlined" key={id} sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}><Typography sx={{ fontWeight: 700 }}>{index + 1}. {byId.get(id)?.revision.title ?? id}</Typography><Stack direction="row"><Button size="small" disabled={!index} onClick={() => move(definition.code, index, -1)}><ArrowUpward fontSize="small" /></Button><Button size="small" disabled={index === orders[definition.code].length - 1} onClick={() => move(definition.code, index, 1)}><ArrowDownward fontSize="small" /></Button></Stack></Paper>)}{!orders[definition.code].length ? <Typography color="text.secondary">В этом слайдере пока нет опубликованных материалов.</Typography> : null}<Box><Button variant="outlined" onClick={() => save(definition.code)} disabled={!orders[definition.code].length}>Сохранить порядок</Button></Box></Stack></Section>)}</Stack>;
}

function buildOrders(items: PublicationDetails[]): Record<PublicationPlacementCode, string[]> {
  return Object.fromEntries(placementDefinitions.map(({ code }) => [code, items.filter((item) => item.entry.status === 'published' && livePlacements(item).some((placement) => placement.placementCode === code)).sort((left, right) => placementOrder(left, code) - placementOrder(right, code)).map((item) => item.entry.id)])) as Record<PublicationPlacementCode, string[]>;
}

function livePlacements(item: PublicationDetails) { return item.currentPlacements ?? item.placements; }
function placementOrder(item: PublicationDetails, code: PublicationPlacementCode) { return livePlacements(item).find((placement) => placement.placementCode === code)?.sortOrder ?? 0; }

function publicationToForm(item: PublicationDetails): PublicationForm {
  const result = emptyForm(item.entry.accessOrganizerId ?? '');
  result.publicationKind = item.entry.publicationKind ?? 'news'; result.title = item.revision.title;
  result.summary = item.revision.summary; result.body = item.revision.body; result.coverAssetId = item.entry.coverAssetId ?? '';
  const placementStart = item.placements.find((placement) => placement.startsAt)?.startsAt;
  const placementEnd = item.placements.find((placement) => placement.endsAt)?.endsAt;
  result.coverUrl = item.entry.coverAssetId ? getContentAssetUrl(item.entry.coverAssetId) : '';
  result.timingMode = placementEnd ? 'period' : item.entry.status === 'scheduled' || placementStart ? 'scheduled' : 'now';
  result.publishStartsAt = result.timingMode === 'now' ? '' : toDateTimeLocal(item.entry.scheduledPublishAt ?? placementStart);
  result.publishEndsAt = toDateTimeLocal(placementEnd);
  for (const placement of item.placements) {
    if (placement.placementCode in result.placements) result.placements[placement.placementCode] = placementToForm(placement);
  }
  return result;
}

function placementToForm(placement: ContentRevisionPlacement): PlacementForm {
  const customized = Boolean(placement.titleOverride || placement.summaryOverride || placement.eyebrowOverride || placement.imageAssetId || placement.actions.length || Object.keys(placement.presentation).length);
  return { enabled: placement.enabled, customized, sortOrder: String(placement.sortOrder), titleOverride: placement.titleOverride ?? '', summaryOverride: placement.summaryOverride ?? '', eyebrowOverride: placement.eyebrowOverride ?? '', imageAssetId: placement.imageAssetId ?? '', imageUrl: placement.imageAssetId ? getContentAssetUrl(placement.imageAssetId) : '', imageTitle: '', actions: [...placement.actions], appearance: normalizeContentAppearance(placement.presentation) };
}

function placementPreviewImage(code: PublicationPlacementCode, placementImage: string, coverImage: string) {
  if (placementImage) return placementImage;
  if (coverImage) return coverImage;
  const fallback = code.startsWith('touge.') ? '/assets/lsr-hero.png' : '/assets/lsr-porsche-hero.png';
  const siteUrl = String(import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '');
  return `${siteUrl}${fallback}`;
}

function publicationKindLabel(kind: string) {
  return kindOptions.find(([value]) => value === kind)?.[1] ?? 'Публикация';
}

function contentSlug(value: string) { const slug = slugify(value).replace(/^-+|-+$/g, ''); return /^[a-z0-9][a-z0-9-]{1,158}$/.test(slug) ? slug.slice(0, 158) : `publication-${Date.now()}`; }
function toDateTimeLocal(value?: string | null) { if (!value) return ''; const date = new Date(value); if (!Number.isFinite(date.getTime())) return ''; return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
function statusLabel(status: string) { return ({ draft: 'Черновик', review: 'На проверке', scheduled: 'Запланировано', published: 'Опубликовано', archived: 'Архив' } as Record<string, string>)[status] ?? status; }
function publicationStatusLabel(item: PublicationDetails) { return item.entry.status === 'published' && item.entry.currentRevisionId !== item.revision.id ? 'Опубликовано · есть черновик' : statusLabel(item.entry.status); }

function publicationCommand(value: unknown, method = 'POST'): RequestInit { return { ...jsonBody(value), method, headers: { 'Idempotency-Key': uuid() } }; }
