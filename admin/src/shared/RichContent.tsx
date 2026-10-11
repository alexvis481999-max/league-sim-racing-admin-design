import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Menu,
  Paper,
  Select,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import FormatColorTextIcon from '@mui/icons-material/FormatColorText';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import ImageIcon from '@mui/icons-material/Image';
import LinkIcon from '@mui/icons-material/Link';
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon';
import GridOnIcon from '@mui/icons-material/GridOn';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { apiFetch, apiUploadFormData, getCatalogImageUrl, getApiBaseUrl } from './api';
import { slugify } from './format';
import type { CatalogItem } from './types';
import { SearchField, useDebouncedValue } from './ui';

type ContentUploadSession = {
  id: string;
  status: 'uploaded' | 'confirmed';
  assetId: string | null;
};

type ContentAsset = {
  id: string;
};

export type PhotoSelection = {
  catalogItemId: string;
  assetId: string;
  url: string;
  title: string;
};

const fontFamilies = [
  { value: 'inherit', label: 'По умолчанию' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Tahoma', label: 'Tahoma' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Courier New', label: 'Courier New' },
];

const fontSizes = [
  { value: '3', label: 'Обычный' },
  { value: '2', label: 'Малый' },
  { value: '4', label: 'Крупный' },
  { value: '5', label: 'Заголовок' },
  { value: '6', label: 'Большой' },
];

const eventEmojis = [
  '🏁',
  '🏎️',
  '🔥',
  '⚡',
  '🏆',
  '🚦',
  '🛠️',
  '📅',
  '📍',
  '⚠️',
  '✅',
  '🎉',
  '💬',
  '👥',
  '🌧️',
  '☀️',
];
type ImageLayout = 'full' | 'left' | 'right';
type ImageWidth = 25 | 50 | 75 | 100;
type EditorPreviewTheme = 'dark' | 'light';

const editorPreviewThemeStorageKey = 'lsr-admin-event-description-theme';

const editorPreviewPalettes: Record<
  EditorPreviewTheme,
  {
    background: string;
    text: string;
    muted: string;
    divider: string;
    tableHeader: string;
    link: string;
  }
> = {
  dark: {
    background: '#0d121b',
    text: '#f5f7fb',
    muted: '#9aa4b2',
    divider: 'rgba(255, 255, 255, 0.14)',
    tableHeader: '#171f2d',
    link: '#6ea0ff',
  },
  light: {
    background: '#ffffff',
    text: '#0a111c',
    muted: '#536171',
    divider: 'rgba(16, 23, 34, 0.18)',
    tableHeader: '#f2f4f7',
    link: '#155eef',
  },
};

function readEditorPreviewTheme(): EditorPreviewTheme {
  try {
    return window.localStorage.getItem(editorPreviewThemeStorageKey) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function exec(command: string, value?: string) {
  document.execCommand('styleWithCSS', false, 'true');
  document.execCommand(command, false, value);
}

function normalizeEditorHtml(value: string) {
  const trimmed = String(value ?? '').trim();
  return trimmed === '<br>' ? '' : trimmed;
}

function photoToSelection(item: CatalogItem): PhotoSelection | null {
  const asset = item.primaryImageAsset;
  if (!asset?.publicUrl) return null;
  return {
    catalogItemId: item.id,
    assetId: item.primaryImageAssetId ?? asset.id,
    url: getCatalogImageUrl(item.id, item.primaryImageAssetId ?? asset.id, asset.publicUrl),
    title: item.title || asset.fileName,
  };
}

export function RichDescriptionEditor({
  value,
  onChange,
  ownerOrganizerId,
  gameCode,
  disabled = false,
  onImagePending,
}: {
  value: string;
  onChange: (value: string) => void;
  ownerOrganizerId: string;
  gameCode: string;
  disabled?: boolean;
  onImagePending?: (name: string, pending: boolean, failed?: boolean) => void;
}) {
  const [imageError, setImageError] = useState('');
  async function pasteFile(file: File) {
    if (disabled) return;
    if (!ownerOrganizerId) {
      setImageError('Сначала выберите организатора');
      return;
    }
    const name = (file.name || 'Изображение из буфера') + ' [' + crypto.randomUUID() + ']';
    saveSelection();
    setImageError('');
    onImagePending?.(name, true);
    try {
      const photo = await uploadDescriptionImage(file, ownerOrganizerId, gameCode);
      if (editorRef.current) {
        insertImage(photo);
        onImagePending?.(name, false);
      } else onImagePending?.(name, false, true);
    } catch (error) {
      onImagePending?.(name, false, true);
      setImageError(error instanceof Error ? error.message : 'Не удалось загрузить изображение');
    }
  }
  const editorRef = useRef<HTMLDivElement | null>(null);
  const replaceImageRef = useRef(false);
  const selectedImageRef = useRef<HTMLImageElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const latestValueRef = useRef(value);
  const lastCommittedValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const [imageLayout, setImageLayout] = useState<ImageLayout>('full');
  const [imageWidth, setImageWidth] = useState<ImageWidth>(100);
  const [imageSelected, setImageSelected] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<EditorPreviewTheme>(readEditorPreviewTheme);
  const [customTextColor, setCustomTextColor] = useState<string | null>(null);
  const [customFillColor, setCustomFillColor] = useState<string | null>(null);
  const previewPalette = editorPreviewPalettes[previewTheme];

  useEffect(() => {
    try {
      window.localStorage.setItem(editorPreviewThemeStorageKey, previewTheme);
    } catch {
      // The editor still works if storage is unavailable.
    }
  }, [previewTheme]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const normalized = normalizeEditorHtml(value).replace(
      /src=(["'])\/content-assets\/([1-9]\d*)\/file\1/g,
      (_, quote, id) =>
        'src=' + quote + getApiBaseUrl() + '/content-assets/' + id + '/file' + quote,
    );
    latestValueRef.current = normalized;
    lastCommittedValueRef.current = normalized;
    if (normalizeEditorHtml(editor.innerHTML) !== normalized) {
      editor.innerHTML = normalized;
    }
  }, [value]);

  useEffect(
    () => () => {
      if (latestValueRef.current !== lastCommittedValueRef.current) {
        lastCommittedValueRef.current = latestValueRef.current;
        onChangeRef.current(latestValueRef.current);
      }
    },
    [],
  );

  function saveSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    selectionRef.current = selection.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    const range = selectionRef.current;
    if (!range) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function commitChange(nextValue = latestValueRef.current) {
    if (nextValue === lastCommittedValueRef.current) return;
    lastCommittedValueRef.current = nextValue;
    onChangeRef.current(nextValue);
  }

  function scheduleChange() {
    const nextValue = normalizeEditorHtml(editorRef.current?.innerHTML ?? '');
    latestValueRef.current = nextValue;
    commitChange(nextValue);
  }

  function emitChange() {
    scheduleChange();
  }

  function run(command: string, commandValue?: string) {
    editorRef.current?.focus();
    exec(command, commandValue);
    emitChange();
  }

  function insertImage(photo: PhotoSelection) {
    if (
      replaceImageRef.current &&
      selectedImageRef.current &&
      editorRef.current?.contains(selectedImageRef.current)
    ) {
      const range = document.createRange();
      range.selectNode(selectedImageRef.current);
      selectionRef.current = range;
      replaceImageRef.current = false;
    }
    restoreSelection();
    const escapedTitle = escapeHtml(photo.title);
    const html = `<img src="${escapeHtml(photo.url)}" alt="${escapedTitle}" data-catalog-item-id="${escapeHtml(photo.catalogItemId)}" data-photo-asset-id="${escapeHtml(photo.assetId)}" data-image-width="${imageWidth}" style="width: ${imageWidth}%;" class="event-description-image event-image-${imageLayout}" />`;
    exec('insertHTML', html);
    const insertedImage =
      [...(editorRef.current?.querySelectorAll<HTMLImageElement>('img') ?? [])]
        .reverse()
        .find((image) => image.dataset.photoAssetId === photo.assetId) ?? null;
    selectedImageRef.current?.classList.remove('is-editor-selected');
    selectedImageRef.current = insertedImage;
    insertedImage?.classList.add('is-editor-selected');
    setImageSelected(Boolean(insertedImage));
    emitChange();
    setImageDialogOpen(false);
  }

  function applyImageWidth(value: number) {
    const nextWidth = Math.min(100, Math.max(25, Math.round(value / 5) * 5)) as ImageWidth;
    setImageWidth(nextWidth);
    const image = selectedImageRef.current;
    if (!image || !editorRef.current?.contains(image)) return;
    image.dataset.imageWidth = String(nextWidth);
    image.style.width = `${nextWidth}%`;
    emitChange();
  }

  function applyImageLayout(layout: ImageLayout) {
    setImageLayout(layout);
    const image = selectedImageRef.current;
    if (!image || !editorRef.current?.contains(image)) return;
    image.classList.remove('event-image-full', 'event-image-left', 'event-image-right');
    image.classList.add('event-description-image', `event-image-${layout}`);
    emitChange();
  }

  function insertEmoji(emoji: string) {
    restoreSelection();
    exec('insertText', emoji);
    emitChange();
    setEmojiAnchor(null);
  }

  function insertTable() {
    restoreSelection();
    const cells = (tag: 'th' | 'td', prefix: string) =>
      `<tr>${[1, 2, 3].map((index) => `<${tag}>${prefix} ${index}</${tag}>`).join('')}</tr>`;
    exec(
      'insertHTML',
      `<table class="event-description-table"><thead>${cells('th', 'Заголовок')}</thead><tbody>${cells('td', 'Значение')}${cells('td', 'Значение')}</tbody></table><p><br></p>`,
    );
    emitChange();
  }

  function applyLink() {
    const href = normalizeLink(linkUrl);
    if (!href) return;
    run('createLink', href);
    setLinkUrl('');
  }

  return (
    <Stack spacing={0.75}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={0.75}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>
            Описание
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Предпросмотр оформления на сайте
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={previewTheme}
          onChange={(_, nextTheme: EditorPreviewTheme | null) => {
            if (nextTheme) setPreviewTheme(nextTheme);
          }}
          aria-label="Тема предпросмотра описания"
        >
          <ToggleButton value="dark" aria-label="Тёмная тема">
            <DarkModeIcon fontSize="small" sx={{ mr: 0.5 }} />
            Тёмная
          </ToggleButton>
          <ToggleButton value="light" aria-label="Светлая тема">
            <LightModeIcon fontSize="small" sx={{ mr: 0.5 }} />
            Светлая
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1 }}>
        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          sx={{
            p: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Шрифт</InputLabel>
            <Select
              label="Шрифт"
              defaultValue="inherit"
              onChange={(event) =>
                event.target.value !== 'inherit' && run('fontName', event.target.value)
              }
            >
              {fontFamilies.map((font) => (
                <MenuItem key={font.value} value={font.value}>
                  {font.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 132 }}>
            <InputLabel>Размер текста</InputLabel>
            <Select
              label="Размер текста"
              defaultValue="3"
              onChange={(event) => run('fontSize', event.target.value)}
            >
              {fontSizes.map((size) => (
                <MenuItem key={size.value} value={size.value}>
                  {size.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ToggleButtonGroup size="small">
            <ToggleButton value="bold" onClick={() => run('bold')} aria-label="Жирный">
              <FormatBoldIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="italic" onClick={() => run('italic')} aria-label="Курсив">
              <FormatItalicIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="underline"
              onClick={() => run('underline')}
              aria-label="Подчеркнутый"
            >
              <FormatUnderlinedIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup size="small">
            <ToggleButton value="ul" onClick={() => run('insertUnorderedList')} aria-label="Список">
              <FormatListBulletedIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="ol"
              onClick={() => run('insertOrderedList')}
              aria-label="Нумерованный список"
            >
              <FormatListNumberedIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup size="small">
            <ToggleButton value="left" onClick={() => run('justifyLeft')} aria-label="Слева">
              <FormatAlignLeftIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="center"
              onClick={() => run('justifyCenter')}
              aria-label="По центру"
            >
              <FormatAlignCenterIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="right" onClick={() => run('justifyRight')} aria-label="Справа">
              <FormatAlignRightIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              minHeight: 38,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <FormatColorTextIcon fontSize="small" />
            <input
              type="color"
              aria-label="Цвет текста"
              value={customTextColor ?? previewPalette.text}
              onChange={(event) => {
                setCustomTextColor(event.target.value);
                run('foreColor', event.target.value);
              }}
            />
          </Box>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              minHeight: 38,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <FormatColorFillIcon fontSize="small" />
            <input
              type="color"
              aria-label="Цвет фона"
              value={customFillColor ?? previewPalette.background}
              onChange={(event) => {
                setCustomFillColor(event.target.value);
                run('hiliteColor', event.target.value);
              }}
            />
          </Box>
          <TextField
            size="small"
            label="Ссылка"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            onFocus={saveSelection}
            sx={{ width: 190 }}
          />
          <Button
            size="small"
            startIcon={<LinkIcon />}
            onMouseDown={(event) => event.preventDefault()}
            onClick={applyLink}
          >
            Ссылка
          </Button>
          <Button
            size="small"
            startIcon={<ImageIcon />}
            onMouseDown={() => saveSelection()}
            onClick={() => setImageDialogOpen(true)}
          >
            Фото
          </Button>
          <Button
            size="small"
            startIcon={<InsertEmoticonIcon />}
            onMouseDown={saveSelection}
            onClick={(event) => setEmojiAnchor(event.currentTarget)}
          >
            Эмодзи
          </Button>
          <Button
            size="small"
            startIcon={<GridOnIcon />}
            onMouseDown={saveSelection}
            onClick={insertTable}
          >
            Таблица
          </Button>
          <Menu
            anchorEl={emojiAnchor}
            open={Boolean(emojiAnchor)}
            onClose={() => setEmojiAnchor(null)}
          >
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 42px)', gap: 0.5, p: 1 }}>
              {eventEmojis.map((emoji) => (
                <Button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  sx={{ minWidth: 42, fontSize: 21 }}
                >
                  {emoji}
                </Button>
              ))}
            </Box>
          </Menu>
        </Stack>
        <Stack direction="row" gap={1}>
          <Button
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              document.execCommand('undo');
              emitChange();
            }}
          >
            Отменить
          </Button>
          <Button
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              document.execCommand('redo');
              emitChange();
            }}
          >
            Повторить
          </Button>
        </Stack>
        {imageSelected && (
          <TextField
            label="Альтернативный текст изображения"
            size="small"
            value={selectedImageRef.current?.alt ?? ''}
            onChange={(e) => {
              if (selectedImageRef.current) {
                selectedImageRef.current.alt = e.target.value;
                emitChange();
              }
            }}
          />
        )}
        {imageSelected ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(240px,1fr) 220px auto' },
              alignItems: 'center',
              gap: 1.5,
              px: 1.5,
              py: 1.25,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Ширина выбранного изображения
                </Typography>
                <Typography variant="subtitle2" color="primary">
                  {imageWidth}%
                </Typography>
              </Stack>
              <Slider
                min={25}
                max={100}
                step={5}
                value={imageWidth}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
                onChange={(_, value) => applyImageWidth(Array.isArray(value) ? value[0] : value)}
                aria-label="Ширина выбранного изображения"
              />
            </Box>
            <FormControl size="small" fullWidth>
              <InputLabel>Расположение</InputLabel>
              <Select
                label="Расположение"
                value={imageLayout}
                onChange={(event) => applyImageLayout(event.target.value as ImageLayout)}
              >
                <MenuItem value="full">Отдельной строкой</MenuItem>
                <MenuItem value="left">Слева от текста</MenuItem>
                <MenuItem value="right">Справа от текста</MenuItem>
              </Select>
            </FormControl>
            <Button size="small" onClick={() => applyImageWidth(100)}>
              На всю ширину
            </Button>
            <Button
              disabled={disabled}
              onClick={() => {
                replaceImageRef.current = true;
                setImageDialogOpen(true);
              }}
            >
              Заменить изображение
            </Button>
            <Button
              disabled={disabled}
              color="error"
              onClick={() => {
                const image = selectedImageRef.current;
                if (!image || !editorRef.current?.contains(image)) return;
                const range = document.createRange();
                range.selectNode(image);
                selectionRef.current = range;
                restoreSelection();
                exec('delete');
                selectedImageRef.current = null;
                setImageSelected(false);
                emitChange();
              }}
            >
              Удалить изображение
            </Button>
          </Box>
        ) : null}
        {imageError && <Typography color="error">{imageError}</Typography>}
        <Box
          sx={{
            minHeight: 360,
            overflow: 'hidden',
            bgcolor: previewPalette.background,
            transition: 'background-color 160ms ease',
          }}
        >
          <Box
            ref={editorRef}
            contentEditable={!disabled}
            data-placeholder="Добавьте описание события…"
            suppressContentEditableWarning
            role="textbox"
            aria-label="Описание события"
            aria-multiline="true"
            onPaste={(event) => {
              const files = [...event.clipboardData.files].filter((file) =>
                file.type.startsWith('image/'),
              );
              if (files.length) {
                event.preventDefault();
                for (const file of files) void pasteFile(file);
              }
            }}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes('Files')) event.preventDefault();
            }}
            onDrop={(event) => {
              const files = [...event.dataTransfer.files].filter((file) =>
                file.type.startsWith('image/'),
              );
              if (files.length) {
                event.preventDefault();
                for (const file of files) void pasteFile(file);
              }
            }}
            onInput={emitChange}
            onBlur={() => {
              saveSelection();
              latestValueRef.current = normalizeEditorHtml(editorRef.current?.innerHTML ?? '');
              commitChange();
            }}
            onMouseUp={saveSelection}
            onClick={(event) => {
              const target = event.target;
              selectedImageRef.current?.classList.remove('is-editor-selected');
              selectedImageRef.current = target instanceof HTMLImageElement ? target : null;
              setImageSelected(target instanceof HTMLImageElement);
              if (target instanceof HTMLImageElement) {
                target.classList.add('is-editor-selected');
                setImageLayout(
                  target.classList.contains('event-image-left')
                    ? 'left'
                    : target.classList.contains('event-image-right')
                      ? 'right'
                      : 'full',
                );
                const storedWidth = Number(
                  target.dataset.imageWidth || target.style.width.replace('%', ''),
                );
                setImageWidth(
                  (Number.isFinite(storedWidth) && storedWidth >= 25 && storedWidth <= 100
                    ? Math.round(storedWidth / 5) * 5
                    : 100) as ImageWidth,
                );
              }
            }}
            onKeyUp={saveSelection}
            sx={{
              display: 'flow-root',
              width: 'min(calc(100% - 24px), 820px)',
              minHeight: 288,
              mx: 'auto',
              my: 4.5,
              px: 1.5,
              outline: 'none',
              overflowWrap: 'anywhere',
              color: previewPalette.text,
              caretColor: previewPalette.text,
              fontSize: '1rem',
              lineHeight: 1.72,
              transition: 'color 160ms ease',
              '&:empty::before': {
                content: 'attr(data-placeholder)',
                color: previewPalette.muted,
                pointerEvents: 'none',
              },
              '& ::selection': {
                bgcolor:
                  previewTheme === 'dark' ? 'rgba(110, 160, 255, 0.34)' : 'rgba(21, 94, 239, 0.22)',
              },
              '& img': {
                maxWidth: '100%',
                height: 'auto',
                borderRadius: '10px',
              },
              '& img.is-editor-selected': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset: 2,
              },
              '& .event-image-full': { display: 'block', width: '100%', my: '18px', clear: 'both' },
              '& .event-image-left': {
                float: 'left',
                width: 'min(42%, 360px)',
                mr: '20px',
                mb: '10px',
                mt: '6px',
              },
              '& .event-image-right': {
                float: 'right',
                width: 'min(42%, 360px)',
                ml: '20px',
                mb: '10px',
                mt: '6px',
              },
              '& .event-description-table': {
                width: '100%',
                borderCollapse: 'collapse',
                clear: 'both',
                my: '20px',
              },
              '& .event-description-table th, & .event-description-table td': {
                border: '1px solid',
                borderColor: previewPalette.divider,
                px: '12px',
                py: '9px',
                textAlign: 'left',
                verticalAlign: 'top',
              },
              '& .event-description-table th': {
                bgcolor: previewPalette.tableHeader,
                fontWeight: 800,
              },
              '& > :first-child': { mt: 0 },
              '& > :last-child': { mb: 0 },
              '& a': { color: previewPalette.link },
            }}
          />
        </Box>
      </Paper>
      <Typography variant="body2" color="text.secondary">
        Чтобы изменить размер или расположение фото, нажмите на него в описании. Настройки появятся
        над текстом.
      </Typography>
      <PhotoCatalogDialog
        open={imageDialogOpen}
        title="Вставить фото в описание"
        ownerOrganizerId={ownerOrganizerId}
        gameCode={gameCode}
        onClose={() => setImageDialogOpen(false)}
        onSelect={insertImage}
        onImagePending={onImagePending}
      />
    </Stack>
  );
}

export function PhotoCatalogDialog({
  open,
  title,
  ownerOrganizerId,
  gameCode,
  onClose,
  onSelect,
  onImagePending,
}: {
  open: boolean;
  title: string;
  ownerOrganizerId: string;
  gameCode: string;
  onClose: () => void;
  onSelect: (photo: PhotoSelection) => void;
  onImagePending?: (name: string, pending: boolean, failed?: boolean) => void;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load(searchOverride = search) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ kind: 'photo' });
      if (searchOverride.trim()) params.set('search', searchOverride.trim());
      const all: CatalogItem[] = [];
      let after: string | null = null;
      do {
        if (after) params.set('afterId', after);
        const page: { items: CatalogItem[]; nextAfterId: string | null } = await apiFetch(
          `/admin/catalog/items?${params}`,
        );
        all.push(...page.items);
        after = page.nextAfterId;
      } while (after);
      setItems(
        all.filter(
          (item) =>
            item.status === 'active' &&
            (item.ownerType === 'platform' || item.ownerId === ownerOrganizerId),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void load(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debouncedSearch]);

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;
    if (onImagePending && !ownerOrganizerId) {
      setError('Сначала выберите организатора');
      return;
    }
    const pendingName = file.name + ' [' + crypto.randomUUID() + ']';
    onImagePending?.(pendingName, true);
    setUploading(true);
    setError('');
    try {
      const photo = await uploadDescriptionImage(file, ownerOrganizerId, gameCode);
      onSelect(photo);
      onImagePending?.(pendingName, false);
      await load();
    } catch (err) {
      onImagePending?.(pendingName, false, true);
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <SearchField
            value={search}
            onChange={setSearch}
            onCommit={(nextValue) => void load(nextValue)}
          />
          <Button variant="contained" component="label" disabled={uploading}>
            {uploading ? 'Загрузка...' : 'Загрузить'}
            <input hidden type="file" accept="image/*" onChange={uploadPhoto} />
          </Button>
        </Stack>
        {error ? (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        ) : null}
        {loading ? <Typography color="text.secondary">Загрузка фото...</Typography> : null}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 1.5,
          }}
        >
          {items.map((item) => {
            const photo = photoToSelection(item);
            return (
              <Paper key={item.id} variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1 }}>
                <Box
                  sx={{
                    height: 190,
                    bgcolor: 'background.default',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {photo ? (
                    <Box
                      component="img"
                      src={photo.url}
                      alt={photo.title}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : null}
                </Box>
                <Stack spacing={1} sx={{ p: 1.25 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>
                    {item.title}
                  </Typography>
                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                    {item.tags.slice(0, 4).map((tag) => (
                      <Chip key={tag} size="small" label={tag} />
                    ))}
                  </Stack>
                  <Button
                    variant="contained"
                    disabled={!photo}
                    onClick={() => photo && onSelect(photo)}
                  >
                    Выбрать
                  </Button>
                </Stack>
              </Paper>
            );
          })}
        </Box>
        {!loading && !items.length ? (
          <Typography color="text.secondary">Фото в каталоге не найдены.</Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}

function derivePhotoCode(fileName: string) {
  return `${slugify(fileName.replace(/\.[^.]+$/, '')) || 'event-photo'}-${Date.now()}`;
}

function gameTagFromGameCode(gameCode: string) {
  if (gameCode === 'assetto_corsa_competizione') return 'acc';
  if (gameCode === 'iracing') return 'iracing';
  return 'ac';
}

function normalizeLink(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    try {
      return new URL(`https://${raw}`).toString();
    } catch {
      return null;
    }
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Shared upload path for file selection, paste and drag/drop. */
export async function uploadDescriptionImage(
  file: File,
  ownerOrganizerId: string,
  gameCode: string,
): Promise<PhotoSelection> {
  const data = new FormData();
  data.set('file', file);
  data.set('assetKind', 'image');
  data.set('ownerType', ownerOrganizerId ? 'organizer' : 'platform');
  if (ownerOrganizerId) data.set('ownerId', ownerOrganizerId);
  const session = await apiUploadFormData<ContentUploadSession>(
    '/admin/content-upload-sessions',
    data,
  );
  const confirmed = await apiFetch<{ asset: ContentAsset }>(
    `/admin/content-upload-sessions/${session.id}/confirm`,
    { method: 'POST' },
  );
  const item = await apiFetch<CatalogItem>('/admin/catalog/items', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'photo',
      code: derivePhotoCode(file.name),
      title: file.name || 'Изображение',
      description: null,
      sourceType: 'mod',
      ownerType: ownerOrganizerId ? 'organizer' : 'platform',
      ownerId: ownerOrganizerId || null,
      gameCode: gameCode || 'site',
      carBrandCode: null,
      officialDlcCode: null,
      archiveAssetId: null,
      tags: [],
      metadata: { source: 'event-authoring' },
      primaryImageAssetId: confirmed.asset.id,
      status: 'active',
    }),
  });
  const selected = photoToSelection(item);
  if (!selected) throw Error('Не удалось получить загруженное изображение');
  return selected;
}
