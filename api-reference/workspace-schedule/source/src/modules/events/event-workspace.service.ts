import { workspaceConditionOrigins } from './workspace-condition-origins';
import type { NotificationInspection } from '../notifications/notification-inspection.contract';
import type { CatalogInspection } from '../catalog/catalog-inspection.contract';
import type { SkinInspection } from '../skins/skin-inspection.contract';
import type { AssettoCorsaGameConfig } from '../runtime/adapters/assetto-corsa/assetto-corsa-game-config.contract';
import type { EventAuthentication } from './event-access.service';
import type { AccessOperations } from '../access/access.contract';
import type { EventContract, EventRecord } from './event.contract';
import type { EventGraphStorage } from './engine/event-graph.storage';
import type { EventManagementRepository } from './database/event-management.repository';
import type { BlockInspection } from '../blocks/contracts/block-inspection.contract';
import type { RuntimeInspection } from '../runtime/runtime-inspection.contract';
import type { RegistrationInspection } from '../registration/registration-inspection.contract';
import type { UserIdentities } from '../users/user-identities.contract';
import type { ResultInspection } from '../results/result-inspection.contract';
import type { RatingInspection } from '../rating/rating-inspection.contract';
import type { ResultsOperations } from '../results/results.contract';
import type { OrganizerOperations } from '../access/organizers.contract';
import type { WorkspacePageQuery, WorkspaceSection } from './event-workspace.contract';
import { AccessDeniedError, EventManagementError } from './event-errors.contract';
import { eventAction } from './event-management.service';
import { scenarioDescriptor } from './authoring/scenario-descriptors';
import {
  blockDisplayStatus,
  blockGroup,
  eventDisplayStatus,
  progressDisplayStatus,
} from './event-status';
import { runtimeDisplayStatus } from '../runtime/runtime-status.contract';
import { registrationDisplayStatus, resultDisplayStatus } from './event-related-status';
import { eventDisplaySchedule } from './event-display-schedule';
import { publicResultPayload } from './public-result-payload';
import { eventDescription } from './authoring/event-description';
import { workspaceWeek } from './workspace-week';

export interface WorkspaceDependencies {
  notifications: NotificationInspection;
  catalog: CatalogInspection;
  skins: SkinInspection;
  authentication: Pick<EventAuthentication, 'admin'>;
  access: Pick<AccessOperations, 'check'>;
  events: EventContract;
  graph: EventGraphStorage;
  repository: EventManagementRepository;
  blocks: BlockInspection;
  runtime: RuntimeInspection;
  registration: RegistrationInspection;
  identities: UserIdentities;
  results: ResultInspection;
  rating: RatingInspection;
  resultDetails: Pick<ResultsOperations, 'getRevision' | 'listJudgingDecisions'>;
  organizers: Pick<OrganizerOperations, 'get'>;
  now(): string;
}
/** Authorized composition. Each reader accesses only its own domain; no per-pilot/stage reads. */
export class EventWorkspaceQueries {
  constructor(private readonly d: WorkspaceDependencies) {}
  private async can(
    actor: string,
    event: EventRecord,
    verb: 'read' | 'write' | 'publish' | 'cancel' | 'registrations.manage',
  ) {
    const target = {
      scopes: [
        { type: 'organizer' as const, id: event.organizerId },
        { type: 'event' as const, id: event.id },
      ],
      ownerId: event.createdById,
    };
    for (const suffix of ['all', 'scoped', 'own'] as const)
      if ((await this.d.access.check(actor, `events.${verb}.${suffix}`, target)).allowed)
        return true;
    return (
      verb === 'write' && (await this.d.access.check(actor, 'events.override.all', target)).allowed
    );
  }
  private async context(token: string, id: string) {
    const actor = await this.d.authentication.admin(token),
      event = await this.d.events.get(id);
    if (!(await this.can(actor.id, event, 'read')))
      throw new AccessDeniedError('event_read_denied');
    const graph = await this.d.graph.getGraph(id);
    if (!graph) throw new EventManagementError('event_graph_missing', 409);
    return { actor, event, graph, plan: await this.d.repository.plan(id) };
  }
  private async snapshot(
    c: Awaited<ReturnType<EventWorkspaceQueries['context']>>,
    details = false,
    blockIds = Object.values(c.graph.blockIdsByKey),
  ) {
    const executionIds = blockIds.flatMap((id) =>
      c.graph.blockExecutionIdsByBlockId[id] ? [c.graph.blockExecutionIdsByBlockId[id]] : [],
    );
    const snapshot = await this.d.blocks.snapshot(blockIds, executionIds, details);
    const runtimeExecutionIds = snapshot.executions
      .filter(
        (e) => snapshot.blocks.find((b) => b.id === e.blockId)?.definition.type !== 'TIME_ATTACK',
      )
      .map((e) => e.id);
    const sessions = await this.d.runtime.sessions(runtimeExecutionIds),
      now = this.d.now();
    const blocks = snapshot.blocks.map((b) => {
      const execution =
        snapshot.executions.find((e) => e.id === c.graph.blockExecutionIdsByBlockId[b.id]) ?? null;
      const runs = sessions.filter((s) => s.requesterId === execution?.id);
      return {
        id: b.id,
        key: b.definition.key,
        title: b.definition.title,
        type: b.definition.type,
        status: execution?.status ?? 'PENDING',
        executionId: execution?.id ?? null,
        plannedStartsAt: b.definition.schedule.startsAt,
        estimatedEndsAt: b.definition.schedule.estimatedEndsAt,
        startedAt: execution?.startedAt ?? null,
        finishedAt: execution?.finishedAt ?? null,
        actualParticipantIds: execution?.actualParticipantIds ?? [],
        displayStatus: blockDisplayStatus(b.definition, execution, runs, now),
        group: c.event.scenarioCode === 'weekly' ? workspaceWeek(c.plan?.settings, b.definition.schedule.startsAt, c.event.timezone, c.event.startsAt) : blockGroup(
          c.event.scenarioCode,
          b.definition.key,
          b.definition.title,
          b.definition.type === 'TOURNAMENT' ? b.definition.settings : null,
        ),
        progress: progressDisplayStatus(
          execution ? (snapshot.progress[execution.id] ?? []) : [],
          runs,
          now,
        ),
        resultIds: Object.values(c.graph.blockResultIdsByKey[b.definition.key] ?? {}),
        sessions: runs.map((s) => ({ ...s, displayStatus: runtimeDisplayStatus(s, now) })),
      };
    });
    return {
      ...snapshot,
      blocks,
      sessions,
      observedAt: now,
      displayStatus: eventDisplayStatus(c.event, blocks, now, c.graph),
    };
  }
  async summary(token: string, id: string) {
    return this.d.graph.transaction(id, async () => {
      const c = await this.context(token, id),
        s = await this.snapshot(c);
      const terminal = ['COMPLETED', 'CANCELLED', 'FAILED'].includes(c.event.status),
        write = await this.can(c.actor.id, c.event, 'write');
      const future = s.blocks.some(
        (b) =>
          !b.startedAt &&
          ['PENDING', 'WAITING'].includes(b.status) &&
          !s.executions.some((e) => e.blockId === b.id && e.participantSnapshotId !== null),
      );
      const started = s.executions.some(
        (e) => e.startedAt !== null || e.participantSnapshotId !== null,
      );
      const actions = [
        eventAction(
          'publish',
          c.event.status === 'DRAFT' && (await this.can(c.actor.id, c.event, 'publish')),
          c.event.status === 'DRAFT'
            ? 'access_denied'
            : terminal
              ? 'event_finished'
              : 'event_already_published',
        ),
        eventAction('edit', write && !terminal, terminal ? 'event_finished' : 'access_denied'),
        eventAction(
          'reschedule',
          write && !terminal && future && !!c.plan,
          terminal
            ? 'event_finished'
            : !write
              ? 'access_denied'
              : !c.plan
                ? 'event_settings_unavailable'
                : 'event_already_started',
        ),
        eventAction(
          'cancel',
          !terminal && (await this.can(c.actor.id, c.event, 'cancel')),
          terminal ? 'event_finished' : 'access_denied',
        ),
        eventAction(
          'copy',
          (c.plan?.settings as { authoring?: { editorVersion?: number } })?.authoring
            ?.editorVersion === 2,
          'event_settings_unavailable',
        ),
      ];
      const author = c.event.createdById
        ? ((await this.d.identities.get([c.event.createdById]))[0] ?? null)
        : null;
      const organizer = await this.d.organizers.get(c.event.organizerId);
      const current = s.blocks.find(
        (b) =>
          b.key === s.displayStatus.currentStage?.key &&
          !['SCHEDULED', 'WAITING'].includes(b.displayStatus.code),
      );
      const nextStage = terminal
        ? undefined
        : [...s.blocks]
            .sort((a, b) => a.plannedStartsAt.localeCompare(b.plannedStartsAt))
            .find((b) => ['SCHEDULED', 'WAITING'].includes(b.displayStatus.code));
      const applications = await this.d.registration.counts(c.event.components.registrationIds);
      const runtime = await this.d.runtime.activity(
        Object.values(c.graph.blockExecutionIdsByBlockId),
      );
      const primary = c.plan?.components.results.find((result) => result.primaryForEvent);
      const definitions = c.plan?.components.blocks ?? [];
      const games = definitions.map(({ block }) => block.game as unknown as AssettoCorsaGameConfig);
      const codes = [...new Set(games.flatMap(game => [game.track.code, ...game.cars.allowedCarIds]))];
      const catalog = codes.length ? await this.d.catalog.items(c.event.gameCode, codes, []) : [];
      const program = s.blocks.map(block => {
        const game = definitions.find(item => item.block.key === block.key)?.block.game as unknown as AssettoCorsaGameConfig | undefined;
        return {
          key: block.key, title: block.title, type: block.type,
          group: block.group, displayStatus: block.displayStatus,
          startsAt: block.plannedStartsAt, endsAt: block.estimatedEndsAt,
          startedAt: block.startedAt, finishedAt: block.finishedAt,
          track: game ? catalog.find(item => item.kind === 'track' && item.code === game.track.code)?.title ?? game.track.code : null,
          cars: (game?.cars.allowedCarIds ?? []).map(code => catalog.find(item => item.kind === 'car' && item.code === code)?.title ?? code),
        };
      });
      const participants = await this.d.blocks.participantCount(Object.values(c.graph.blockExecutionIdsByBlockId));
      return {
        eventId: id,
        version: c.event.version ?? '1',
        observedAt: s.observedAt,
        event: {
          ...c.event,
          description: eventDescription(c.event.description).html,
          scenarioTitle: scenarioDescriptor(c.event.scenarioCode)?.title ?? null,
          displayStatus: s.displayStatus,
          observedAt: s.observedAt,
          displaySchedule: c.plan
            ? eventDisplaySchedule(c.plan.components.blocks.map((b) => b.block))
            : null,
        },
        metadata: {
          ...(await this.d.repository.metadata(id)),
          author,
          organizer: organizer ? { id: organizer.id, name: organizer.name } : null,
        },
        currentStage: current ? { key: current.key, title: current.title } : null,
        nextStage: nextStage
          ? { key: nextStage.key, title: nextStage.title, startsAt: nextStage.plannedStartsAt }
          : null,
        stop: c.graph.stop,
        actions,
        editableFields:
          write && !terminal
            ? started ||
              (c.plan?.settings as { authoring?: { editorVersion?: number } })?.authoring
                ?.editorVersion !== 2
              ? ['description']
              : ['description', 'settings']
            : [],
        program,
        counts: { stages: s.blocks.length, results: c.event.components.resultIds.length, participants },
        activity: {
          applications,
          runtime,
          hasRegistration: c.event.components.registrationIds.length > 0,
        },
        primaryResultId: primary ? (c.graph.resultIdsByKey[primary.key] ?? null) : null,
      };
    });
  }
  async section(token: string, id: string, section: WorkspaceSection, q: WorkspacePageQuery) {
    return this.d.graph.transaction(id, async () => {
      const c = await this.context(token, id),
        executionIds = Object.values(c.graph.blockExecutionIdsByBlockId);
      if (section === 'attendance') {
        const page = await this.d.blocks.participants(executionIds, q),
          identities = await this.d.identities.get(page.items.map((p) => p.participantId));
        return {
          ...page,
          items: page.items.map((p) => ({
            ...p,
            identity: identities.find((i) => i.participantId === p.participantId) ?? null,
            stages: p.blockIds.map((id) => {
              const key = Object.keys(c.graph.blockIdsByKey).find(
                (key) => c.graph.blockIdsByKey[key] === id,
              )!;
              return {
                key,
                title:
                  c.plan?.components.blocks.find((b) => b.block.key === key)?.block.title ??
                  'Название этапа не сохранено',
              };
            }),
          })),
        };
      }
      if (section === 'attempts') {
        if (!q.blockId || !Object.values(c.graph.blockIdsByKey).includes(q.blockId))
          throw new EventManagementError('event_block_not_found', 404);
        const executionId = c.graph.blockExecutionIdsByBlockId[q.blockId];
        if (!executionId) return { items: [], nextAfterId: null };
        const page = await this.d.blocks.attempts(executionId, q);
        const runs = await this.d.runtime.sessions([executionId], {
          sessionIds: page.items.flatMap((item) =>
            item.runtimeSessionId ? [item.runtimeSessionId] : [],
          ),
        });
        return {
          ...page,
          items: progressDisplayStatus(page.items, runs, this.d.now()).map((item, index) => ({
            ...item,
            id: page.items[index].id,
          })),
        };
      }
      if (section === 'notifications') {
        if (!(await this.d.access.check(c.actor.id, 'notifications.admin.delivery')).allowed)
          throw new AccessDeniedError('notification_inspection_denied');
        return this.d.notifications.event(id, q);
      }
      if (section === 'edit')
        return {
          settings: c.plan?.settings ?? null,
          version: c.event.version ?? '1',
          description: c.event.description,
        };
      if (section === 'history') return this.d.repository.history(id, q);
      if (section === 'runtime-history') return this.d.runtime.history(executionIds, q);
      if (section === 'presence') return this.d.runtime.presence(executionIds, q);
      if (section === 'rating') {
        const page = await this.d.rating.page(c.event.components.ratingId, q);
        const identities = await this.d.identities.get(
          page.items.flatMap((a) => a.changes.map((p) => p.participantId)),
        );
        return { ...page, identities };
      }
      if (section === 'results') {
        if (q.resultId && !c.event.components.resultIds.includes(q.resultId))
          throw new EventManagementError('event_result_not_found', 404);
        const page = await this.d.results.page(
          q.resultId ? [q.resultId] : c.event.components.resultIds,
          q,
        );
        return {
          ...page,
          items: page.items.map((r) => ({
            ...r,
            title:
              c.plan?.components.blocks.find((b) =>
                Object.values(c.graph.blockResultIdsByKey[b.block.key] ?? {}).includes(r.id),
              )?.block.title ??
              (r.definition.primaryForEvent ? 'Итог события' : `Результат №${r.id}`),
            displayStatus: resultDisplayStatus(r, this.d.now()),
          })),
        };
      }
      if (section === 'revisions' || section === 'result') {
        if (!q.resultId || !c.event.components.resultIds.includes(q.resultId))
          throw new EventManagementError('event_result_not_found', 404);
        if (section === 'revisions') return this.d.results.revisions(q.resultId, q);
        if (!q.revisionId) throw new EventManagementError('result_revision_required', 400);
        const revision = await this.d.resultDetails.getRevision(q.revisionId);
        if (revision.resultId !== q.resultId)
          throw new EventManagementError('event_result_not_found', 404);
        return {
          ...revision,
          payload: publicResultPayload(revision.payload),
          decisions: await this.d.resultDetails.listJudgingDecisions(q.resultId),
        };
      }
      if (section === 'participants') {
        const states = await this.d.registration.states(c.event.components.registrationIds);
        const page = await this.d.registration.entries(c.event.components.registrationIds, q);
        const identities = await this.d.identities.get(page.items.map((e) => e.participantId));
        const carCodes = page.items.flatMap((e) =>
          typeof e.selection?.data.carId === 'string' ? [e.selection.data.carId] : [],
        );
        const skinIds = page.items.flatMap((e) =>
          typeof e.selection?.data.skinId === 'string' ? [e.selection.data.skinId] : [],
        );
        const cars = await this.d.catalog.items(c.event.gameCode, carCodes, []),
          skins = await this.d.skins.selections(skinIds);
        const canWrite = await this.can(c.actor.id, c.event, 'registrations.manage');
        const editable = (r: (typeof states)[number]) =>
          canWrite &&
          ['PUBLISHED', 'RUNNING'].includes(c.event.status) &&
          !['CLOSED', 'CANCELLED'].includes(r.status) &&
          Date.parse(this.d.now()) < Date.parse(r.definition.config.closesAt);
        return {
          ...page,
          registrations: states.map((r) => ({
            id: r.id,
            key: r.definition.key,
            config: r.definition.config,
            admission: r.definition.admission ?? null,
            displayStatus: registrationDisplayStatus(r, this.d.now()),
            actions: [
              eventAction(
                'add',
                editable(r) && r.definition.config.mode === 'locked_roster',
                canWrite ? 'registration_closed' : 'access_denied',
              ),
            ],
          })),
          items: page.items.map((e) => {
            const r = states.find((r) => r.id === e.registrationId)!;
            return {
              ...e,
              registrationKey: r.definition.key,
              identity: identities.find((p) => p.participantId === e.participantId) ?? null,
              car:
                cars.find((car) => car.kind === 'car' && car.code === e.selection?.data.carId) ??
                null,
              skin: skins.find((skin) => skin.id === e.selection?.data.skinId) ?? null,
              actions: [
                eventAction(
                  'review',
                  editable(r) && e.status === 'PENDING',
                  canWrite ? 'registration_closed' : 'access_denied',
                ),
                eventAction(
                  'remove',
                  editable(r) && e.status === 'ACCEPTED',
                  canWrite ? 'registration_closed' : 'access_denied',
                ),
              ],
            };
          }),
        };
      }
      if (section === 'runtime') {
        const rows = await this.d.runtime.sessions(executionIds, { ...q, limit: q.limit + 1 });
        const reservations = await this.d.runtime.reservations(
          Object.values(c.graph.reservationIdsByBlockKey),
        );
        return {
          items: rows
            .slice(0, q.limit)
            .map((s) => ({ ...s, displayStatus: runtimeDisplayStatus(s, this.d.now()) })),
          nextAfterId: rows.length > q.limit ? rows[q.limit - 1].id : null,
          reservations: reservations.map((r) => {
            const blockKey = Object.keys(c.graph.reservationIdsByBlockKey).find(
              (key) => c.graph.reservationIdsByBlockKey[key] === r.id,
            )!;
            return {
              ...r,
              blockKey,
              stageTitle:
                c.plan?.components.blocks.find((b) => b.block.key === blockKey)?.block.title ??
                null,
            };
          }),
        };
      }
      if (section === 'schedule') {
        if (q.stageKey && !c.graph.blockIdsByKey[q.stageKey])
          throw new EventManagementError('event_block_not_found', 404);
        const ids = (
          q.stageKey ? [c.graph.blockIdsByKey[q.stageKey]] : Object.values(c.graph.blockIdsByKey)
        )
          .sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))
          .filter((id) => !q.afterId || BigInt(id) > BigInt(q.afterId));
        const page = ids.slice(0, q.limit),
          s = await this.snapshot(c, true, page),
          registrations = await this.d.registration.states(c.event.components.registrationIds);
        return {
          items: s.blocks.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1)),
          nextAfterId: ids.length > q.limit ? page.at(-1)! : null,
          registrations: registrations.map((r) => ({
            key: r.definition.key,
            config: r.definition.config,
            displayStatus: registrationDisplayStatus(r, s.observedAt),
          })),
          dependencies: c.plan?.components.blockInputs ?? null,
        };
      }
      if (section === 'conditions') {
        if (q.stageKey && !c.graph.blockIdsByKey[q.stageKey])
          throw new EventManagementError('event_block_not_found', 404);
        const definitions = (c.plan?.components.blocks ?? []).filter(
          (b) => !q.stageKey || b.block.key === q.stageKey,
        );
        const games = definitions.map((b) => b.block.game as unknown as AssettoCorsaGameConfig);
        const catalog = await this.d.catalog.items(
          c.event.gameCode,
          games.flatMap((g) => [
            g.track.code,
            ...g.cars.allowedCarIds,
            ...(g.catalogChoices?.pluginCodes ?? []),
            ...(g.catalogChoices?.weatherCodes ?? []),
            ...(g.catalogChoices?.carSetCode ? [g.catalogChoices.carSetCode] : []),
          ]),
          games.flatMap((g) => (g.catalogPins ?? []).map((pin) => pin.itemId)),
        );
        const stages = definitions.map(({ block }) => {
          const game = block.game as unknown as AssettoCorsaGameConfig;
          const { track, cars, environment, assists, simulation, finishRules, catalogChoices } =
            game;
          const layouts = game.catalogPins?.find(
            (pin) => pin.kind === 'track' && pin.code === track.code,
          )?.metadata.layouts;
          const layout = Array.isArray(layouts)
            ? layouts.find(
                (value) =>
                  value && typeof value === 'object' && value.code === (track.layoutCode ?? ''),
              )
            : null;
          return {
            key: block.key,
            title: block.title,
            type: block.type,
            origins: workspaceConditionOrigins(c.event.scenarioCode, c.plan?.settings, block.key),
            carClass:
              catalog.find((i) => i.kind === 'car_set' && i.code === catalogChoices?.carSetCode) ??
              null,
            weatherPresets: (catalogChoices?.weatherCodes ?? [])
              .map(
                (code) =>
                  catalog.find((i) => i.kind === 'weather_preset' && i.code === code) ?? null,
              )
              .filter(Boolean),
            plugins: (catalogChoices?.pluginCodes ?? [])
              .map((code) => catalog.find((i) => i.kind === 'plugin' && i.code === code) ?? null)
              .filter(Boolean),
            game: { track, cars, environment, assists, simulation, finishRules, catalogChoices },
            settings: block.settings,
            admission: block.admission ?? null,
            content: (game.catalogPins ?? []).map((pin) => ({
              itemId: pin.itemId,
              versionId: pin.versionId,
              kind: pin.kind,
              code: pin.code,
              title: catalog.find((i) => i.id === pin.itemId)?.title ?? null,
              imageUrl: catalog.find((i) => i.id === pin.itemId)?.imageUrl ?? null,
            })),
            layoutTitle: typeof layout?.title === 'string' ? layout.title : null,
            track: catalog.find((i) => i.kind === 'track' && i.code === track.code) ?? null,
            cars: cars.allowedCarIds.map(
              (code) =>
                catalog.find((i) => i.kind === 'car' && i.code === code) ?? {
                  code,
                  title: null,
                  imageUrl: null,
                },
            ),
          };
        });
        return {
          stages: c.plan ? stages : null,
          registrations:
            c.plan?.components.registrations.map((r) => ({
              key: r.registration.key,
              admission: r.registration.admission ?? null,
              selection: r.registration.selection,
            })) ?? null,
          results: c.plan?.components.results ?? null,
          rating: c.plan?.components.rating ?? null,
        };
      }
      throw new EventManagementError('invalid_workspace_section', 400);
    });
  }
}
