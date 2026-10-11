// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {Button,Table,TableBody,TableCell,TableRow} from '@mui/material';
import {ListRecord} from './ui';
import {openableRow} from './table';
afterEach(cleanup);
it('keeps a record primary target independent from destructive actions',()=>{
 const open=vi.fn(),remove=vi.fn();
 render(<ListRecord id="9" title="Событие" onOpen={open} openLabel="Открыть событие" actions={<Button onClick={remove}>Удалить</Button>}/>);
 fireEvent.click(screen.getByRole('button',{name:'Удалить'}));expect(remove).toHaveBeenCalledTimes(1);expect(open).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Открыть событие'}));expect(open).toHaveBeenCalledTimes(1);
});
it('opens table rows by cell and keyboard without handling nested button events twice',()=>{
 const open=vi.fn(),remove=vi.fn();
 render(<Table><TableBody><TableRow {...openableRow(open)}><TableCell>Запись</TableCell><TableCell><Button onClick={remove}>Удалить</Button></TableCell></TableRow></TableBody></Table>);
 fireEvent.click(screen.getByText('Запись'));expect(open).toHaveBeenCalledTimes(1);
 fireEvent.keyDown(screen.getByRole('row'),{key:'Enter'});expect(open).toHaveBeenCalledTimes(2);
 fireEvent.keyDown(screen.getByRole('row'),{key:' '});expect(open).toHaveBeenCalledTimes(3);
 fireEvent.click(screen.getByRole('button',{name:'Удалить'}));fireEvent.keyDown(screen.getByRole('button',{name:'Удалить'}),{key:'Enter'});
 expect(remove).toHaveBeenCalledTimes(1);expect(open).toHaveBeenCalledTimes(3);
});
