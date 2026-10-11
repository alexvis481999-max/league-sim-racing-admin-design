import { useEffect, useState } from 'react';
import { Alert, MenuItem, TextField } from '@mui/material';
import type { WeatherConfig } from './WeatherFields';
import { ContentSelectionFields } from '../event-authoring/ContentSelectionFields';
import type { Settings } from '../event-authoring/types';
import { apiFetch } from '../../shared/api';
export type GameConfig = {
  track: { code: string; layoutCode: string | null };
  cars: { allowedCarIds: string[]; defaultCarId: string };
  environment: {
    sunAngle: number;
    weather: WeatherConfig;
    dynamicTrack: {
      sessionStart: number;
      randomness: number;
      sessionTransfer: number;
      lapGain: number;
    };
  };
  assists: {
    absAllowed: number;
    tractionControlAllowed: number;
    stabilityAllowed: boolean;
    forceVirtualMirror: boolean;
    autoClutchAllowed?: boolean;
    tyreBlanketsAllowed?: boolean;
  };
  simulation: {
    tyreWearRatePercent: number;
    fuelRatePercent: number;
    damageMultiplierPercent: number;
    allowedTyresOut: number;
    legalTyres: string[];
  };
  finishRules: { qualifyingMaximumWaitPercent: number; raceOverTimeSeconds: number };
  catalogChoices?: { pluginCodes?: string[]; weatherCodes?: string[]; carSetCode?: string };
};
export const defaultGame = (): GameConfig => ({
  track: { code: '', layoutCode: null },
  cars: { allowedCarIds: [], defaultCarId: '' },
  environment: {
    sunAngle: 16,
    weather: {
      mode: 'FIXED',
      presetCode: '3_clear',
      ambientTemperature: 18,
      roadTemperature: 28,
      ambientVariation: 2,
      roadVariation: 2,
    },
    dynamicTrack: { sessionStart: 89, randomness: 3, sessionTransfer: 80, lapGain: 50 },
  },
  assists: {
    absAllowed: 1,
    tractionControlAllowed: 1,
    stabilityAllowed: false,
    forceVirtualMirror: false,
  },
  simulation: {
    tyreWearRatePercent: 100,
    fuelRatePercent: 100,
    damageMultiplierPercent: 100,
    allowedTyresOut: 2,
    legalTyres: [],
  },
  finishRules: { qualifyingMaximumWaitPercent: 120, raceOverTimeSeconds: 180 },
  catalogChoices: { pluginCodes: [] },
});
export function GameFields({
  value,
  onChange,
  disabled = false,
  allowRandomWeather = true,
  onlyRules = false,
  disableTrackLimits = false,
  organizerId = '',
}: {
  value: GameConfig;
  onChange(value: GameConfig): void;
  disabled?: boolean;
  allowRandomWeather?: boolean;
  onlyRules?: boolean;
  disableTrackLimits?: boolean;
  organizerId?: string;
}) {
  return (
    <ContentSelectionFields
      value={
        (onlyRules
          ? {
              ...value,
              assists: {
                ...value.assists,
                autoClutchAllowed: value.assists.autoClutchAllowed ?? true,
                tyreBlanketsAllowed: value.assists.tyreBlanketsAllowed ?? true,
              },
            }
          : value) as unknown as Settings
      }
      onChange={(next) => onChange(next as unknown as GameConfig)}
      disabled={disabled}
      organizerId={organizerId}
      standalone
      disableTrackLimits={disableTrackLimits}
      onlyRules={onlyRules}
      allowRandomWeather={allowRandomWeather}
    />
  );
}
export function OrganizerField({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange(v: string): void;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<{ id: string; name: string }[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    apiFetch<{ id: string; name: string }[]>('/admin/access/organizers')
      .then((v) => {
        if (active) setItems(v);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <TextField
        select
        label="Организатор"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <MenuItem value="">Выберите организатора</MenuItem>
        {value && !items.some((item) => item.id === value) && (
          <MenuItem value={value}>Организатор №{value}</MenuItem>
        )}
        {items.map((i) => (
          <MenuItem key={i.id} value={i.id}>
            {i.name}
          </MenuItem>
        ))}
      </TextField>
      {error && <Alert severity="error">{error}</Alert>}
    </>
  );
}
/** Один ключ сохраняется при неопределённом сетевом результате. */
export function command<T>(path: string, body: unknown, key: string, method = 'POST') {
  return apiFetch<T>(path, {
    method,
    body: JSON.stringify(body),
    headers: { 'Idempotency-Key': key },
  });
}
