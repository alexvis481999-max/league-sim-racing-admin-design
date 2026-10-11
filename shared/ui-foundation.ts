/** Presentation constants only. No API or sporting rules belong here. */
export const uiFoundation = {
  fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
  pageWidth: 1180,
  adminPageWidth: 1560,
  pageGap: 3,
  fieldGap: 2,
  controlRadius: 4,
  dialogRadius: 8,
} as const;

/** Shared geometry; each application's established palette and density are retained. */
export const commonComponentStyles = {
  MuiDialog: { styleOverrides: { paper: { borderRadius: uiFoundation.dialogRadius, backgroundImage: 'none' } } },
  MuiDialogTitle: { styleOverrides: { root: { fontWeight: 800, overflowWrap: 'anywhere' as const } } },
  MuiDialogActions: { styleOverrides: { root: { padding: '16px 24px', gap: 8, flexWrap: 'wrap' as const } } },
  MuiTabs: { defaultProps: { variant: 'scrollable' as const, scrollButtons: 'auto' as const }, styleOverrides: { root: { minHeight: 44 } } },
  MuiTab: { styleOverrides: { root: { minHeight: 44, fontWeight: 750 } } },
  MuiTextField: { defaultProps: { fullWidth: true } },
  MuiOutlinedInput: { styleOverrides: { root: { borderRadius: uiFoundation.controlRadius } } },
  MuiTableContainer: { styleOverrides: { root: { overflowX: 'auto' as const } } },
  MuiTableCell: { styleOverrides: { head: { fontWeight: 800 }, root: { verticalAlign: 'top' as const } } },
  MuiAlert: { styleOverrides: { root: { borderRadius: uiFoundation.controlRadius }, message: { minWidth: 0, overflowWrap: 'anywhere' as const } } },
} as const;
