// @vitest-environment jsdom
import {useState} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {TrackLayoutFields} from './TrackLayoutFields';
afterEach(cleanup);
it('keeps capacity and touge metadata when editing another layout field',()=>{
  const initial={layouts:[{code:'',title:'Основная',tougeZones:{assetId:'9'}},{code:'short',title:'Короткая',pitboxes:12}]};
  function Form(){const [metadata,setMetadata]=useState(JSON.stringify(initial));return <><TrackLayoutFields metadata={metadata} onChange={setMetadata}/><output data-testid="saved">{metadata}</output></>;}
  render(<Form/>);
  fireEvent.change(screen.getByLabelText('Количество мест конфигурации 1'),{target:{value:'24'}});
  fireEvent.change(screen.getByLabelText('Код конфигурации 1'),{target:{value:'gp'}});
  const saved=JSON.parse(screen.getByTestId('saved').textContent!);
  expect(saved.layouts[0]).toMatchObject({code:'gp',pitboxes:24,tougeZones:{assetId:'9'}});
  expect(saved.layouts[1]).toEqual(initial.layouts[1]);
  fireEvent.change(screen.getByLabelText('Количество мест конфигурации 1'),{target:{value:'0'}});
  expect(screen.getByText('Введите целое число больше нуля')).toBeTruthy();
});
