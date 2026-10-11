// Dev-only reference catalogue. Synthetic titles; shapes follow the client types of /games/assetto_corsa/*.
export const TRACKS = [
  { code: 'monza', title: 'Monza', layouts: [{ code: '', title: 'Grand Prix' }, { code: 'junior', title: 'Junior' }] },
  { code: 'spa', title: 'Spa-Francorchamps', layouts: [{ code: '', title: 'Grand Prix' }] },
  { code: 'imola', title: 'Imola', layouts: [{ code: '', title: 'Grand Prix' }] },
  { code: 'silverstone', title: 'Silverstone', layouts: [{ code: 'gp', title: 'Grand Prix' }, { code: 'national', title: 'National' }] },
  { code: 'nurburgring', title: 'Nürburgring GP', layouts: [{ code: 'gp', title: 'Grand Prix' }] },
  { code: 'suzuka', title: 'Suzuka', layouts: [{ code: '', title: 'Grand Prix' }] },
  { code: 'brands_hatch', title: 'Brands Hatch', layouts: [{ code: 'gp', title: 'Grand Prix' }, { code: 'indy', title: 'Indy' }] },
  { code: 'barcelona', title: 'Barcelona', layouts: [{ code: 'gp', title: 'Grand Prix' }] },
  { code: 'red_bull_ring', title: 'Red Bull Ring', layouts: [{ code: 'gp', title: 'Grand Prix' }] },
  { code: 'zandvoort', title: 'Zandvoort', layouts: [{ code: '', title: 'Grand Prix' }] },
  { code: 'misano', title: 'Misano', layouts: [{ code: '', title: 'Grand Prix' }] },
  { code: 'mugello', title: 'Mugello', layouts: [{ code: '', title: 'Grand Prix' }] },
  { code: 'akina', title: 'Akina', layouts: [{ code: 'downhill', title: 'Downhill' }, { code: 'uphill', title: 'Uphill' }] },
];
export const CARS = [
  { code: 'bmw_m4_gt3', title: 'BMW M4 GT3' },
  { code: 'porsche_911_gt3_r', title: 'Porsche 911 GT3 R' },
  { code: 'ferrari_488_gt3', title: 'Ferrari 488 GT3' },
  { code: 'audi_r8_lms', title: 'Audi R8 LMS' },
  { code: 'bmw_m4_gt4', title: 'BMW M4 GT4' },
  { code: 'toyota_ae86', title: 'Toyota AE86' },
  { code: 'mazda_rx7_fd', title: 'Mazda RX-7 FD' },
];
export const CAR_SETS = [{ code: 'gt3_2026', title: 'GT3 · сезон 2026', metadata: { carIds: ['bmw_m4_gt3', 'porsche_911_gt3_r', 'ferrari_488_gt3', 'audi_r8_lms'] } }];
export const WEATHER = [
  { code: '3_clear', title: 'Ясно' },
  { code: '4_mid_clear', title: 'Переменная облачность' },
  { code: '7_heavy_clouds', title: 'Пасмурно' },
];
export const PLUGINS = [{ code: 'csp', title: 'Custom Shaders Patch' }];

export const trackItem = (code) => {
  const t = TRACKS.find((x) => x.code === code);
  return t ? { id: 'cat-track-' + code, kind: 'track', code, title: t.title, imageUrl: null } : null;
};
export const carItem = (code) => {
  const c = CARS.find((x) => x.code === code);
  return c ? { id: 'cat-car-' + code, kind: 'car', code, title: c.title, imageUrl: null } : { code, title: null, imageUrl: null };
};
export const weatherItem = (code) => {
  const w = WEATHER.find((x) => x.code === code);
  return w ? { id: 'cat-weather-' + code, kind: 'weather_preset', code, title: w.title, imageUrl: null } : null;
};

export function referenceRoute(path) {
  const p = path.replace(/^\/games\/assetto_corsa\//, '');
  if (p === 'cars') return CARS.map((c) => ({ ...c, imageUrl: null }));
  if (p === 'tracks') return TRACKS.map((t) => ({ code: t.code, title: t.title, imageUrl: null, metadata: { layouts: t.layouts } }));
  if (p === 'car-sets') return CAR_SETS;
  if (p === 'catalog/plugin') return PLUGINS;
  if (p === 'weather-presets') return WEATHER;
  return null;
}

export const PILOTS = ['Marko77', 'KostyaRS', 'Rival', 'ApexMaks', 'NightShift', 'VolkRacing', 'racer_24', 'Spitfire', 'DimiPro', 'Racecraft', 'EvgenGT', 'Ghost44', 'Astra_R', 'Kirik', 'GreenFlag', 'LateBraker', 'Pitwall', 'Slipstream', 'Torque', 'Vortex']
  .map((name, i) => ({ participantId: String(700 + i), displayName: name }));
