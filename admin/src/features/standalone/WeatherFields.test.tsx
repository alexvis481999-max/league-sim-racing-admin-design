// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WeatherFields, type WeatherConfig } from './WeatherFields';
afterEach(cleanup);
const slot = {
  presetCode: 'clear',
  ambientTemperature: 18,
  roadTemperature: 28,
  ambientVariation: 2,
  roadVariation: 3,
};
it('редактирование ручной погоды сохраняет второй слот', () => {
  const value: WeatherConfig = {
      mode: 'MANUAL',
      slots: [slot, { ...slot, presetCode: 'rain', ambientTemperature: 12 }],
    },
    onChange = vi.fn();
  render(
    <WeatherFields value={value} items={[]} allowRandom disabled={false} onChange={onChange} />,
  );
  fireEvent.change(screen.getAllByLabelText('Температура воздуха')[0], { target: { value: '21' } });
  expect(onChange).toHaveBeenCalledWith({
    mode: 'MANUAL',
    slots: [{ ...slot, ambientTemperature: 21 }, value.slots[1]],
  });
});
it('редактирование случайной погоды сохраняет все варианты', () => {
  const value: WeatherConfig = {
      mode: 'RANDOM',
      presetCodes: ['clear', 'rain'],
      ambientTemperature: 18,
      roadTemperature: 28,
      ambientVariation: 2,
      roadVariation: 3,
    },
    onChange = vi.fn();
  render(
    <WeatherFields value={value} items={[]} allowRandom disabled={false} onChange={onChange} />,
  );
  fireEvent.change(screen.getByLabelText('Температура трассы'), { target: { value: '30' } });
  expect(onChange).toHaveBeenCalledWith({ ...value, roadTemperature: 30 });
});

it('выбирает графику и температуру пресета, сохраняя отдельно его код каталога', () => {
  const onChange = vi.fn();
  render(
    <WeatherFields
      value={{ ...slot, mode: 'FIXED' }}
      items={[
        {
          code: 'custom-sun',
          title: 'Летний день',
          metadata: {
            graphics: '3_clear',
            ambientTemperature: 25,
            roadTemperature: 35,
            ambientVariation: 1,
            roadVariation: 1,
          },
        },
      ]}
      catalogCodes={['clear']}
      allowRandom
      disabled={false}
      onChange={onChange}
    />,
  );
  fireEvent.mouseDown(screen.getByLabelText('Погода'));
  fireEvent.click(screen.getByRole('option', { name: 'Летний день' }));
  expect(onChange).toHaveBeenCalledWith(
    {
      mode: 'FIXED',
      presetCode: '3_clear',
      ambientTemperature: 25,
      roadTemperature: 35,
      ambientVariation: 1,
      roadVariation: 1,
    },
    ['custom-sun'],
  );
});
it('правка температуры не теряет сохранённую ссылку на пользовательский пресет', () => {
  const onChange = vi.fn();
  render(
    <WeatherFields
      value={{ ...slot, presetCode: '3_clear', mode: 'FIXED' }}
      items={[]}
      catalogCodes={['custom-sun']}
      allowRandom
      disabled={false}
      onChange={onChange}
    />,
  );
  fireEvent.change(screen.getByLabelText('Температура воздуха'), { target: { value: '24' } });
  expect(onChange).toHaveBeenCalledWith(
    { ...slot, presetCode: '3_clear', ambientTemperature: 24, mode: 'FIXED' },
    ['custom-sun'],
  );
});
