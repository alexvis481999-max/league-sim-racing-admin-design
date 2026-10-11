import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Stack, Typography, Skeleton } from '@mui/material';
import { apiFetch } from '../../../shared/api';
import {
  Page,
  ListToolbar,
  SearchField,
  FilterButtons,
  CreateAction, ListRecord,
  useDebouncedValue,
} from '../../../shared/ui';
import { useRealtimeRefresh } from '../../../shared/realtime';
import { displayDateTime } from '../../../../../shared/presentation';
import type { AdminAccess } from '../../../shared/types';
import type { EventSummary } from './event-api';
import type { Draft, Settings } from '../../../features/event-authoring/types';
export function CurrentEventsPage({ access }: { access: AdminAccess }) {
  const navigate = useNavigate(),
    [items, setItems] = useState<EventSummary[]>([]),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [query, setQuery] = useState(''),
    [publication, setPublication] = useState(''),
    [draftCursor, setDraftCursor] = useState<string | null>(null),
    [error, setError] = useState(''),[loading,setLoading]=useState(true);
  const q = useDebouncedValue(query),
    generation = useRef(0);

  const canCreate = access.grants?.some((grant) =>
    grant.permissions.some((p) => p.startsWith('events.write.')),
  );
  async function load(more = false, silent=false) {
    const revision = ++generation.current;
    if(!silent){setLoading(true);if(!more){setItems([]);setDrafts([]);}}
    try {
      const eventParams = new URLSearchParams({limit:'20',view:'list'}), draftParams=new URLSearchParams();
      if(q){eventParams.set('q',q);draftParams.set('q',q);}
      if(publication)eventParams.set('publication',publication);
      if(more&&cursor)eventParams.set('afterId',cursor);
      if(more&&draftCursor)draftParams.set('afterId',draftCursor);
      const [eventsResult,draftsResult]=await Promise.all([
        !more||cursor?apiFetch<{items:EventSummary[];nextAfterId:string|null}>('/admin/events?'+eventParams):null,
        canCreate&&publication!=='published'&&(!more||draftCursor)?apiFetch<{items:Draft[];nextAfterId:string|null}>('/admin/event-drafts?'+draftParams):null,
      ]);
      if(revision!==generation.current)return;
      if(eventsResult){setItems(old=>more?[...old,...eventsResult.items]:eventsResult.items);setCursor(eventsResult.nextAfterId);}
      if(draftsResult){setDrafts(old=>more?[...old,...draftsResult.items]:draftsResult.items);setDraftCursor(draftsResult.nextAfterId);}
      else if(!more){setDrafts([]);setDraftCursor(null);}
      setError('');
    }catch(e){if(revision===generation.current)setError(String(e));}finally{if(revision===generation.current)setLoading(false);}
  }
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [q, publication]);
  useRealtimeRefresh(['events','runtime'], () => load(false,true));
  return (
    <Page
      title="События"
      actions={
        canCreate ? (
          <CreateAction label="Создать событие" onClick={() => navigate('/events/new')} />
        ) : undefined
      }
    >
      {error && <Alert severity="error">{error}</Alert>}
      <ListToolbar>
        <SearchField label="Поиск" value={query} onChange={setQuery} />
        <FilterButtons label="Публикация" value={publication} onChange={setPublication} options={[
          {value:'',label:'Все'},
          {value:'published',label:'Опубликованные'},
          {value:'unpublished',label:'Неопубликованные'},
        ]}/>
      </ListToolbar>
      {loading&&Array.from({length:6},(_,i)=><Stack key={i} spacing={1} sx={{py:2,borderBottom:1,borderColor:'divider'}}><Skeleton width="55%" height={28}/><Skeleton width="35%" height={20}/></Stack>)}
      {!loading&&!error&&!items.length&&!drafts.length&&<Typography color="text.secondary">События не найдены.</Typography>}
      {!!items.length && <Stack direction="row" gap={2.5} sx={{px:2,pt:1}}><Typography variant="caption" color="text.secondary" sx={{width:'5ch',fontFamily:'monospace'}}>ID</Typography><Typography variant="caption" color="text.secondary">Событие</Typography></Stack>}
      <div>{items.map(event=><ListRecord key={event.id} id={event.id} title={event.title} to={'/events/'+event.id} openLabel={'Открыть '+event.title} meta={<>{event.scenarioTitle} · {event.displayStatus.label} · {displayDateTime(event.startsAt)}</>}/>)}</div>
      <div>{drafts.map(draft=>{
        const title=String((draft.document.settings.event as Settings|undefined)?.title||'Без названия');
        return <ListRecord key={draft.id} id={draft.id} title={title} meta="Черновик" to={'/events/new?draft='+draft.id} openLabel={'Продолжить '+title}
          actions={<Button color="error" onClick={()=>{
            if(!window.confirm('Удалить этот черновик?'))return;
            void apiFetch('/admin/event-drafts/'+draft.id,{method:'DELETE',headers:{'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({expectedVersion:draft.revision})}).then(()=>load()).catch(e=>setError(String(e)));
          }}>Удалить</Button>}/>;
      })}</div>
      {(cursor||draftCursor)&&<Button disabled={loading} onClick={()=>void load(true)}>Ещё</Button>}
    </Page>
  );
}
