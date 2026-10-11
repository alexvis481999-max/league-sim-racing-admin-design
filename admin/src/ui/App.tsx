import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { SteamCallbackPage } from '../pages/auth/SteamCallbackPage';
import { RequireAdmin } from '../layout/RequireAdmin';
import { NotificationsViewport } from '../shared/notifications';
import { appTheme } from './theme';
import './v16';

export function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <BrowserRouter>
        <div className="lsr-root">
          <NotificationsViewport />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/steam/callback" element={<SteamCallbackPage />} />
            <Route path="/*" element={<RequireAdmin />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
