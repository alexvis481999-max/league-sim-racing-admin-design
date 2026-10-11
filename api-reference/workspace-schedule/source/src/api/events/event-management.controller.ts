/** HTTP управления событиями; разрешения, расчёты времени и атомарность остаются в Events. */
import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { EVENT_MANAGEMENT } from '../../modules/events/events.tokens';
import {EVENT_WORKSPACE,type EventWorkspaceOperations,type WorkspaceSection} from '../../modules/events/event-workspace.contract';
import type { EventManagementOperations } from '../../modules/events/event-api.contract';
import { HttpContract } from '../transport/http-contract';
import { ApiError, componentKey, id, noQuery, pageLimit, pathValue, query, type ApiRequest } from '../transport/http-values';
import { registrationTarget } from './events.dto';
import { EventCancelDto, EventEditDto, EventRescheduleDto, EventRosterDto, type EventCancelBody, type EventEditBody, type EventRescheduleBody, type EventRosterBody } from './event-management.dto';
const target = (r: ApiRequest) => { id(pathValue(r, 'eventId')); noQuery(r); };
@Controller()
export class EventManagementController {
  public constructor(@Inject(EVENT_MANAGEMENT) private readonly events: EventManagementOperations,@Inject(EVENT_WORKSPACE) private readonly workspaceQueries:EventWorkspaceOperations) {}
  @Get('admin/events')
  @HttpContract({ operation: 'listAdminEvents', summary: 'Доступные события с фильтрами', bearer: 'admin', errors: 'events', response: 'AdminEventPage', query: { view: { type: 'string', example: 'list' }, limit: { type: 'integer' }, afterId: { type: 'string' }, q: { type: 'string' }, status: { type: 'string' }, publication: { type: 'string' }, organizerId: { type: 'string' }, scenarioCode: { type: 'string' } } })
  public list(@Req() r: ApiRequest) {
    const q = query(r, ['limit', 'afterId', 'q', 'status', 'publication', 'organizerId', 'scenarioCode', 'view'], 'invalid_event_page');
    if(q.has('view')&&q.get('view')!=='list')throw new ApiError(400,'invalid_event_page');
    if(q.has('publication')&&!['published','unpublished'].includes(q.get('publication')!))throw new ApiError(400,'invalid_event_page');
    if (q.has('status') && !['DRAFT', 'PUBLISHED', 'RUNNING', 'COMPLETED', 'CANCELLED', 'FAILED'].includes(q.get('status')!)) throw new ApiError(400, 'invalid_event_page');
    if ((q.get('q')?.length ?? 0) > 200) throw new ApiError(400, 'invalid_event_page');
    return this.events.list(r.apiToken!, { limit: pageLimit(q.get('limit') ?? '20', 100, 'invalid_event_page', 3),
      ...(q.has('view') ? {view:'list' as const}:{}),
      ...(q.has('publication') ? {publication:q.get('publication')!}:{}),
      ...(q.has('afterId') ? { afterId: id(q.get('afterId')) } : {}), ...(q.has('organizerId') ? { organizerId: id(q.get('organizerId')) } : {}),
      ...(q.has('q') ? { q: q.get('q')! } : {}), ...(q.has('status') ? { status: q.get('status')! } : {}), ...(q.has('scenarioCode') ? { scenarioCode: q.get('scenarioCode')! } : {}) });
  }
  @Get('admin/events/:eventId/copy-template')
  @HttpContract({ operation: 'copyEventTemplate', summary: 'Настройки для нового события без дат', bearer: 'admin', errors: 'events', response: 'EventTemplate', validate: target })
  public copy(@Req() r: ApiRequest) { return this.events.copy(r.apiToken!, pathValue(r, 'eventId')); }
  @Get('admin/events/:eventId/workspace')
  @HttpContract({ operation: 'getEventWorkspace', summary: 'Сводка события и доступные команды', bearer: 'admin', errors: 'events', response: 'EventWorkspaceSummary', validate: target })
  public workspace(@Req() r: ApiRequest) { return this.workspaceQueries.summary(r.apiToken!, pathValue(r, 'eventId')); }
  @Get('admin/events/:eventId/workspace/:section')
  @HttpContract({operation:'getEventWorkspaceSection',summary:'Подробности события с независимой пагинацией',bearer:'admin',errors:'events',response:'EventWorkspaceSection',query:{limit:{type:'integer'},afterId:{type:'string'},stateGroup:{type:'string'},stageKey:{type:'string'},blockId:{type:'string'},participantId:{type:'string'},resultId:{type:'string'},revisionId:{type:'string'}}})
  public section(@Req() r:ApiRequest) {
    const eventId=id(pathValue(r,'eventId')),section=pathValue(r,'section');
    if(!['edit','schedule','attendance','attempts','participants','conditions','runtime','runtime-history','presence','results','revisions','result','rating','history','notifications'].includes(section))throw new ApiError(400,'invalid_workspace_section');
    const q=query(r,['limit','stateGroup','stageKey','afterId','blockId','participantId','resultId','revisionId'],'invalid_workspace_page');
    if(q.has('stateGroup')&&!['active','finished','uncertain'].includes(q.get('stateGroup')!))throw new ApiError(400,'invalid_workspace_page');
    return this.workspaceQueries.section(r.apiToken!,eventId,section as WorkspaceSection,{limit:pageLimit(q.get('limit')??'25',100,'invalid_workspace_page',3),
      ...(q.has('afterId')?{afterId:id(q.get('afterId'))}:{}),...(q.has('participantId')?{participantId:id(q.get('participantId'))}:{}),
      ...(q.has('stateGroup')?{stateGroup:q.get('stateGroup') as 'active'|'finished'|'uncertain'}:{}),...(q.has('stageKey')?{stageKey:componentKey(q.get('stageKey')!,'invalid_stage_key')}:{}),...(q.has('blockId')?{blockId:id(q.get('blockId'))}:{}),...(q.has('resultId')?{resultId:id(q.get('resultId'))}:{}),...(q.has('revisionId')?{revisionId:id(q.get('revisionId'))}:{})});
  }
  @Patch('admin/events/:eventId') @HttpCode(200)
  @HttpContract({ operation: 'editEvent', summary: 'Совместимо изменить событие', bearer: 'admin', command: true, body: EventEditDto, errors: 'events', response: 'EventVersion', validate: target })
  public edit(@Req() r: ApiRequest, @Body() body: EventEditBody) { return this.events.edit(r.apiToken!, pathValue(r, 'eventId'), body.expectedVersion, body.patch, r.apiCommandId!); }
  @Post('admin/events/:eventId/reschedule') @HttpCode(200)
  @HttpContract({ operation: 'rescheduleEvent', summary: 'Перенести будущие части события', bearer: 'admin', command: true, body: EventRescheduleDto, errors: 'events', response: 'EventRescheduled', validate: target })
  public reschedule(@Req() r: ApiRequest, @Body() body: EventRescheduleBody) { return this.events.reschedule(r.apiToken!, pathValue(r, 'eventId'), body.expectedVersion, body.changes, r.apiCommandId!); }
  @Post('admin/events/:eventId/cancel') @HttpCode(200)
  @HttpContract({ operation: 'cancelEvent', summary: 'Отменить событие и остановить сессии', bearer: 'admin', command: true, body: EventCancelDto, errors: 'events', response: 'EventCancelled', responses: [200, 202], validate: target })
  public async cancel(@Req() r: ApiRequest, @Body() body: EventCancelBody, @Res() response: ServerResponse) {
    const result = await this.events.cancel(r.apiToken!, pathValue(r, 'eventId'), body.expectedVersion, body.reason, r.apiCommandId!);
    response.statusCode = result.stopState === 'STOPPED' ? 200 : 202; response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(result)); return result;
  }
  @Post('admin/events/:eventId/registrations/:registrationKey/roster') @HttpCode(201)
  @HttpContract({ operation: 'addEventRosterEntry', summary: 'Добавить участника фиксированного состава', bearer: 'admin', command: true, body: EventRosterDto, errors: 'registration', response: 'EventRosterEntry', validate: registrationTarget })
  public add(@Req() r: ApiRequest, @Body() body: EventRosterBody) { return this.events.roster(r.apiToken!, pathValue(r, 'eventId'), pathValue(r, 'registrationKey'), body.expectedVersion, body, r.apiCommandId!); }
  @Post('admin/events/:eventId/registrations/:registrationKey/entries/:entryId/remove') @HttpCode(200)
  @HttpContract({ operation: 'removeEventRosterEntry', summary: 'Удалить участника с причиной', bearer: 'admin', command: true, body: EventCancelDto, errors: 'registration', response: 'EventRosterEntry', validate: registrationTarget })
  public remove(@Req() r: ApiRequest, @Body() body: EventCancelBody) { return this.events.roster(r.apiToken!, pathValue(r, 'eventId'), pathValue(r, 'registrationKey'), body.expectedVersion, { entryId: pathValue(r, 'entryId'), reason: body.reason }, r.apiCommandId!); }
}
