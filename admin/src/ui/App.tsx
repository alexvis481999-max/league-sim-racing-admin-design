import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { SteamCallbackPage } from '../pages/auth/SteamCallbackPage';
import { RequireAdmin } from '../layout/RequireAdmin';
import { NotificationsViewport } from '../shared/notifications';
import { commonComponentStyles, uiFoundation } from '../../../shared/ui-foundation';

const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#155eef', dark: '#0f3ea8', light: '#4f8cff' },
    secondary: { main: '#0891b2', dark: '#0e7490', light: '#67e8f9' },
    background: { default: '#f4f8fb', paper: '#ffffff' },
    text: { primary: '#111827', secondary: '#5b6b82' },
    divider: '#dbe7f3',
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: uiFoundation.fontFamily,
    button: { textTransform: 'none', fontWeight: 750 },
  },
  components: {
    ...commonComponentStyles,
    MuiCssBaseline: {
      styleOverrides: {
        html: { scrollbarGutter: 'stable' },
      },
    },
    MuiButton: { defaultProps: { size: 'small' }, styleOverrides: { root: { minHeight: 36 } } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiPaper: { styleOverrides: { root: { boxShadow: 'none' } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 800 }, root: { borderColor: '#dbe7f3', verticalAlign: 'top' } } },
  },
});

export function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <BrowserRouter>
        <NotificationsViewport />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/steam/callback" element={<SteamCallbackPage />} />
          <Route path="/*" element={<RequireAdmin />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
