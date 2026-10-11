import { Avatar, Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { memo } from 'react';
import {CatalogTagBadges} from '../../shared/CatalogTagBadges';
import { catalogActorLabel } from './catalogActor';
import { getCatalogImageUrl } from '../../shared/api';
import { formatDate } from '../../shared/format';
import { EmptyTableRow } from '../../shared/table';
import type { AccessOrganizer, CatalogItem, CatalogKind, CatalogUsage } from '../../shared/types';

export type CatalogKindViewProps = {
  kind: CatalogKind;
  items: CatalogItem[];
  organizerById: Map<string, AccessOrganizer>;
  showOwner: boolean;
  onEdit: (item: CatalogItem) => void;
};

function CatalogKindViewComponent(props: CatalogKindViewProps) {
  if (props.kind === 'photo') return <PhotoCatalogView {...props} />;
  if (props.kind === 'skin') return <SkinCatalogView {...props} />;
  if (props.kind === 'weather_preset') return <WeatherCatalogView {...props} />;
  if (props.kind === 'car_set') return <CarSetCatalogView {...props} />;
  return <RuntimeCatalogListView {...props} />;
}

export const CatalogKindView = memo(CatalogKindViewComponent);

function PhotoCatalogView({ items, organizerById, onEdit }: CatalogKindViewProps) {
  if (!items.length) return <Typography variant="body2" color="text.secondary">Фото не найдены.</Typography>;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(220px, 1fr))', lg: 'repeat(3, minmax(220px, 1fr))', xl: 'repeat(4, minmax(220px, 1fr))' }, gap: 1.5 }}>
      {items.map((item) => (
        <Paper
          key={item.id}
          variant="outlined"
          role="button"
          tabIndex={0}
          onClick={() => onEdit(item)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') onEdit(item);
          }}
          sx={{
            overflow: 'hidden',
            borderRadius: 1,
            cursor: 'pointer',
            transition: 'border-color 120ms ease, box-shadow 120ms ease',
            '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
            '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
          }}
        >
          <Box sx={{ position: 'relative', height: 180, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box
              component="img"
              src={catalogItemImageUrl(item)}
              alt={item.title}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <Box sx={{ position: 'absolute', top: 8, left: 8 }}>
              <UsageCounter count={item.usages.length} />
            </Box>
            <CatalogTagBadges tags={item.tags}/>
          </Box>
          <Stack spacing={1} sx={{ p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
              <Typography sx={{ fontWeight: 700 }} noWrap>{item.title}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {photoOwnerLine(item, organizerById)} · Добавил: {actorName(item)} · {item.storageStatus === 'present' ? 'Файл загружен' : 'Файла нет'}
            </Typography>
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}

function SkinCatalogView({ items, organizerById, onEdit }: CatalogKindViewProps) {
  if (!items.length) return <Typography variant="body2" color="text.secondary">Скины не найдены.</Typography>;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
      {items.map((item) => (
        <Paper
          key={item.id}
          variant="outlined"
          role="button"
          tabIndex={0}
          onClick={() => onEdit(item)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') onEdit(item);
          }}
          sx={{
            p: 1.25,
            borderRadius: 1,
            cursor: 'pointer',
            transition: 'border-color 120ms ease, box-shadow 120ms ease',
            '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
            '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Thumb item={item} size={88} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 750 }} noWrap>{item.title}</Typography>
              <Typography variant="caption" color="text.secondary">{ownerLabel(item, organizerById)} · Добавил: {actorName(item)}</Typography>
              <AvailabilityChip status={item.status} />
              <TagList tags={item.tags} />
            </Box>
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}

function RuntimeCatalogListView({ kind, items, organizerById, showOwner, onEdit }: CatalogKindViewProps) {
  const showImage = kind !== 'plugin';
  const showOfficialDlc = kind === 'car' || kind === 'track';
  const colSpan = (showImage ? 1 : 0) + (showOwner ? 6 : 5) + (showOfficialDlc ? 1 : 0);

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          {showImage ? <TableCell>IMG</TableCell> : null}
          <TableCell>ID</TableCell>
          <TableCell>Название</TableCell>
          {showOwner ? <TableCell>Владелец</TableCell> : null}
          {showOfficialDlc ? <TableCell>DLC</TableCell> : null}
          <TableCell>Добавил</TableCell>
          <TableCell>Теги</TableCell>
          <TableCell>Обновлено</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) => (
          <TableRow
            key={item.id}
            hover
            role="button"
            tabIndex={0}
            onClick={() => onEdit(item)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onEdit(item);
            }}
            sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}
          >
            {showImage ? <TableCell><Thumb item={item} /></TableCell> : null}
            <TableCell>{item.code}</TableCell>
            <TableCell>
              <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
              {item.description ? <Typography variant="caption" color="text.secondary">{item.description}</Typography> : null}
            </TableCell>
            {showOwner ? <TableCell>{ownerLabel(item, organizerById)}</TableCell> : null}
            {showOfficialDlc ? <TableCell>{item.officialDlc?.title ?? '—'}</TableCell> : null}
            <TableCell><ActorCell item={item} /></TableCell>
            <TableCell><TagList tags={item.tags} /></TableCell>
            <TableCell>{formatDate(item.updatedAt)}</TableCell>
          </TableRow>
        ))}
        {!items.length ? <EmptyTableRow colSpan={colSpan} /> : null}
      </TableBody>
    </Table>
  );
}

function WeatherCatalogView({ items, onEdit }: CatalogKindViewProps) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Код</TableCell>
          <TableCell>Название</TableCell>
          <TableCell>Graphics</TableCell>
          <TableCell>Температура</TableCell>
          <TableCell>Ветер</TableCell>
          <TableCell>Добавил</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) => (
          <TableRow
            key={item.id}
            hover
            role="button"
            tabIndex={0}
            onClick={() => onEdit(item)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onEdit(item);
            }}
            sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}
          >
            <TableCell>{item.code}</TableCell>
            <TableCell>{item.title}</TableCell>
            <TableCell>{String(item.graphics ?? item.metadata.graphics ?? '-')}</TableCell>
            <TableCell>{String(item.ambientTemperature ?? item.metadata.ambientTemperature ?? '-')} / {String(item.roadTemperature ?? item.metadata.roadTemperature ?? '-')}</TableCell>
            <TableCell>{String(item.windSpeed ?? item.metadata.windSpeed ?? '-')}</TableCell>
            <TableCell><ActorCell item={item} /></TableCell>
          </TableRow>
        ))}
        {!items.length ? <EmptyTableRow colSpan={6} /> : null}
      </TableBody>
    </Table>
  );
}

function CarSetCatalogView({ items, onEdit }: CatalogKindViewProps) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Код</TableCell>
          <TableCell>Название</TableCell>
          <TableCell>Машин</TableCell>
          <TableCell>Теги</TableCell>
          <TableCell>Добавил</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) => (
          <TableRow
            key={item.id}
            hover
            role="button"
            tabIndex={0}
            onClick={() => onEdit(item)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onEdit(item);
            }}
            sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}
          >
            <TableCell>{item.code}</TableCell>
            <TableCell>{item.title}</TableCell>
            <TableCell>{Array.isArray(item.metadata.carIds) ? item.metadata.carIds.length : 0}</TableCell>
            <TableCell><TagList tags={item.tags} /></TableCell>
            <TableCell><ActorCell item={item} /></TableCell>
          </TableRow>
        ))}
        {!items.length ? <EmptyTableRow colSpan={5} /> : null}
      </TableBody>
    </Table>
  );
}

function Thumb({ item, size = 56 }: { item: CatalogItem; size?: number }) {
  const url = catalogItemImageUrl(item);
  return <Box component="img" src={url} alt={item.title} sx={{ width: size, height: Math.round(size * 0.72), borderRadius: 1, objectFit: 'cover', display: 'block' }} />;
}

function catalogItemImageUrl(item: CatalogItem): string {
  if (item.primaryImageAsset) {
    return getCatalogImageUrl(item.id, item.primaryImageAssetId ?? item.primaryImageAsset.id, item.primaryImageAsset.publicUrl);
  }
  if (item.kind === 'car' || item.kind === 'track') return '/assets/lsr-logo-placeholder.svg';
  return '/assets/catalog-photo-placeholder.svg';
}

function AvailabilityChip({ status }: { status: string }) {
  return <Chip size="small" variant="outlined" color={status === 'active' ? 'success' : 'default'} label={status === 'active' ? 'Доступен' : 'Недоступен'} />;
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return <Typography variant="caption" color="text.secondary">-</Typography>;
  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
      {tags.slice(0, 5).map((tag) => <Chip key={tag} size="small" label={tag} />)}
    </Stack>
  );
}

function UsageCounter({ count }: { count: number }) {
  return (
    <Tooltip title={count ? 'Используется' : 'Не используется'}>
      <Chip size="small" variant="outlined" color={count ? 'success' : 'default'} label={count} />
    </Tooltip>
  );
}

function UsageList({ usages }: { usages: CatalogUsage[] }) {
  if (!usages.length) return <Typography variant="caption" color="text.secondary">Не используется</Typography>;
  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
      {usages.slice(0, 4).map((usage) => (
        <Tooltip key={usage.id} title={[usageLabel(usage.usageType), usage.targetId, usage.placement, usage.url].filter(Boolean).join(' · ')}>
          <Chip size="small" variant="outlined" label={`${usageLabel(usage.usageType)}: ${usage.targetTitle}`} component={usage.url ? 'a' : 'div'} href={usage.url || undefined} clickable={Boolean(usage.url)} target={usage.url ? '_blank' : undefined} />
        </Tooltip>
      ))}
      {usages.length > 4 ? <Chip size="small" label={`+${usages.length - 4}`} /> : null}
    </Stack>
  );
}

function usageLabel(type: CatalogUsage['usageType']) {
  if (type === 'championship') return 'Чемпионат';
  if (type === 'event') return 'Событие';
  if (type === 'news') return 'Новость';
  if (type === 'page') return 'Страница';
  return 'Другое';
}

function ActorCell({ item }: { item: CatalogItem }) {
  const actor = item.createdBy;
  if (!actor) return <Typography variant="caption" color="text.secondary">#{item.createdByUserId}</Typography>;
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Avatar src={actor.steamAvatar ?? undefined} alt={actor.steamName} sx={{ width: 24, height: 24 }} />
      <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{catalogActorLabel(item)}</Typography>
    </Stack>
  );
}

function ownerLabel(item: CatalogItem, organizerById: Map<string, AccessOrganizer>) {
  if (item.sourceType === 'platform') return 'Platform';
  if (item.sourceType === 'official' || item.sourceType === 'vanilla') return 'Official';
  return item.submittedByOrganizerId ? (organizerById.get(item.submittedByOrganizerId)?.name ?? item.submittedByOrganizerId) : 'Организатор';
}

function actorName(item: CatalogItem) {
  return catalogActorLabel(item);
}

function photoOwnerLine(item: CatalogItem, organizerById: Map<string, AccessOrganizer>) {
  if (item.sourceType === 'official' || item.sourceType === 'vanilla') return 'Official';
  return ownerLabel(item, organizerById);
}
