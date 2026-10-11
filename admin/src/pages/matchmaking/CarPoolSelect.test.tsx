// @vitest-environment jsdom
import { useState } from 'react';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { CarPoolSelect } from './CarPoolSelect';
afterEach(cleanup);
function Example(){const [value,setValue]=useState(['a','missing']);return <CarPoolSelect label="Машины" items={[{code:'a',title:'Mazda'},{code:'b',title:'Toyota'}]} value={value} onChange={setValue}/>;}
it('keeps selected and missing cars visible as removable chips and supports bulk selection',async()=>{
  render(<Example/>);
  expect(screen.getByText('missing (недоступен)')).toBeTruthy();
  await userEvent.click(screen.getByRole('button',{name:'Выбрать все'}));
  expect(screen.getByText('Toyota')).toBeTruthy();
  const chip=screen.getByText('Mazda').closest('.MuiChip-root')!;
  fireEvent.click(within(chip as HTMLElement).getByTestId('CancelIcon'));
  expect(screen.queryByText('Mazda')).toBeNull();
  await userEvent.click(screen.getByRole('button',{name:'Очистить'}));
  expect(screen.getByText('Машины не выбраны.')).toBeTruthy();
});
it('adds a car through search without replacing existing choices',async()=>{
  render(<Example/>);
  await userEvent.type(screen.getByRole('combobox'),'Toyota');
  await userEvent.click(await screen.findByRole('option',{name:'Toyota'}));
  await userEvent.click(screen.getByRole('button',{name:'Добавить'}));
  expect(screen.getByText('Машины · 3')).toBeTruthy();
  expect(screen.getByText('Mazda')).toBeTruthy();
});
