import { createTheme } from '@mui/material/styles';
import { commonComponentStyles } from '../../../shared/ui-foundation';

/** MUI controls that remain inside complex forms follow the v16 tokens (see ui/v16/v16.css). */
const v16 = {
  ink: '#172232', text: '#36465b', sub: '#637387', blue: '#285ed6', line: '#e1e5eb', line2: '#edf0f3', inputLine: '#d5dce6',
  font: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
};

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: v16.blue, dark: '#1e50c5', light: '#4977ec' },
    secondary: { main: '#46648e' },
    error: { main: '#b24440' },
    warning: { main: '#96621d' },
    success: { main: '#1b7654' },
    info: { main: '#275caf' },
    background: { default: '#f5f6f8', paper: '#ffffff' },
    text: { primary: v16.ink, secondary: v16.sub },
    divider: v16.line,
    action: { hover: '#f3f6fa', selected: '#eef3ff' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: v16.font,
    fontSize: 14,
    body1: { fontSize: 14, lineHeight: 1.46 },
    body2: { fontSize: 13, lineHeight: 1.46 },
    caption: { fontSize: 12, color: v16.sub },
    h4: { fontSize: 26, fontWeight: 750, letterSpacing: '-.8px' },
    h5: { fontSize: 20, fontWeight: 750 },
    h6: { fontSize: 15, fontWeight: 750, letterSpacing: 0 },
    subtitle1: { fontSize: 14, fontWeight: 700 },
    overline: { fontSize: 11, fontWeight: 750, letterSpacing: '.65px', color: v16.sub },
    button: { textTransform: 'none', fontWeight: 650, fontSize: 13 },
  },
  components: {
    ...commonComponentStyles,
    MuiCssBaseline: { styleOverrides: { html: { scrollbarGutter: 'stable' }, body: { fontSize: 14, lineHeight: 1.46, background: '#f5f6f8', color: v16.ink } } },
    MuiButton: {
      defaultProps: { size: 'small', disableElevation: true },
      styleOverrides: {
        root: { minHeight: 36, borderRadius: 9, padding: '8px 13px', lineHeight: 1.2, whiteSpace: 'nowrap', boxShadow: 'none' },
        sizeSmall: { fontSize: 13 },
        contained: { '&:hover': { boxShadow: 'none' } },
        outlined: { borderColor: v16.line, color: v16.text, background: '#fff', '&:hover': { background: '#f3f6fa', borderColor: v16.line } },
        text: { '&:hover': { background: '#eef1f5' } },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true, slotProps: { inputLabel: { shrink: true } } } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiFormControl: { styleOverrides: { root: { minWidth: 0 } } },
    MuiInputLabel: {
      defaultProps: { shrink: true },
      styleOverrides: {
        root: { position: 'relative', transform: 'none', fontSize: 12, fontWeight: 680, color: v16.text, marginBottom: 6, lineHeight: 1.35, whiteSpace: 'normal', overflow: 'visible', maxWidth: '100%', '&.Mui-focused': { color: v16.text }, '&.Mui-error': { color: '#ae4743' }, '&.Mui-disabled': { color: v16.sub } },
        asterisk: { color: '#b24440' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8, background: '#fff', fontSize: 14, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#b9c4d3' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: v16.blue, borderWidth: 1, boxShadow: '0 0 0 3px #9dbbf755' }, '&.Mui-disabled': { background: '#f2f4f7' } },
        notchedOutline: { borderColor: v16.inputLine, top: 0, '& legend': { display: 'none' } },
        input: { padding: '9px 11px', minHeight: 20 },
        multiline: { padding: '9px 11px' },
      },
    },
    MuiAutocomplete: { styleOverrides: { inputRoot: { padding: '4px 8px !important' }, tag: { margin: 2, height: 24 }, paper: { borderRadius: 9, border: `1px solid ${v16.line}`, boxShadow: '0 10px 30px #12203822' } } },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 0, marginRight: 0, marginTop: 5, fontSize: 11, color: v16.sub, '&.Mui-error': { color: '#ae4743' } } } },
    MuiFormControlLabel: { styleOverrides: { label: { fontSize: 13 } } },
    MuiCheckbox: { defaultProps: { size: 'small' } },
    MuiSwitch: { defaultProps: { size: 'small' } },
    MuiPaper: { styleOverrides: { root: { boxShadow: 'none', backgroundImage: 'none' }, outlined: { borderColor: v16.line, borderRadius: 11 } } },
    MuiMenu: { styleOverrides: { paper: { borderRadius: 9, border: `1px solid ${v16.line}`, boxShadow: '0 10px 30px #12203822 !important' } } },
    MuiMenuItem: { styleOverrides: { root: { fontSize: 13, minHeight: 34 } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 14, boxShadow: '0 30px 100px #101c3066' } } },
    MuiDialogTitle: { styleOverrides: { root: { fontWeight: 750, fontSize: 18, padding: '20px 22px', borderBottom: `1px solid ${v16.line}`, overflowWrap: 'anywhere' } } },
    MuiDialogContent: { styleOverrides: { root: { padding: '21px 22px !important' } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '16px 22px', gap: 8, flexWrap: 'wrap', borderTop: `1px solid ${v16.line}` } } },
    MuiTabs: { defaultProps: { variant: 'scrollable', scrollButtons: 'auto' }, styleOverrides: { root: { minHeight: 44, borderBottom: `1px solid ${v16.line}` }, indicator: { height: 2, backgroundColor: v16.blue } } },
    MuiTab: { styleOverrides: { root: { minHeight: 44, minWidth: 0, padding: '12px 16px', fontWeight: 660, fontSize: 14, color: v16.sub, textTransform: 'none', '&.Mui-selected': { color: v16.blue }, '&:hover': { background: '#f1f4f9' } } } },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: v16.line2, verticalAlign: 'middle', fontSize: 13, padding: '11px 12px', color: v16.ink },
        head: { background: '#f8fafc', fontSize: 11.5, fontWeight: 740, color: v16.sub, whiteSpace: 'nowrap', borderColor: v16.line },
      },
    },
    MuiTableRow: { styleOverrides: { hover: { '&:hover': { background: '#f3f7ff !important' } } } },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 9, fontSize: 13, padding: '4px 14px', border: '1px solid transparent', alignItems: 'center' },
        standardInfo: { background: '#f2f7ff', color: '#34527c', borderColor: '#deebff' },
        standardWarning: { background: '#fff8ec', color: '#865b25', borderColor: '#f5e6c8' },
        standardError: { background: '#fff1ef', color: '#9f3d3d', borderColor: '#f8d6d2' },
        standardSuccess: { background: '#ebf7f1', color: '#1b7654', borderColor: '#d7efe3' },
        icon: { opacity: .85 },
        message: { minWidth: 0, overflowWrap: 'anywhere' },
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 6, fontSize: 12, fontWeight: 650, height: 24 }, outlined: { borderColor: v16.line, color: v16.text, background: '#f4f6fa' } } },
    MuiTooltip: { styleOverrides: { tooltip: { background: '#1a293b', fontSize: 12, borderRadius: 8, padding: '7px 10px' } } },
    MuiPagination: { defaultProps: { shape: 'rounded', size: 'small' } },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 20, height: 7, background: '#e8edf4' }, bar: { background: '#4d7add' } } },
  },
});
