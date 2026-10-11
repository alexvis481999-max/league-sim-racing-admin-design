import {In,MoreThan} from 'typeorm';
import type {TransactionService} from '../../database/transaction.service';
import type {BlockInspection} from './contracts/block-inspection.contract';
import {BlockEntity} from './database/block.entity';
import {ExecutionEntity} from './database/block-execution.entity';
import {ExecutionMemberEntity} from './database/block-execution-member.entity';
import {ExecutionSessionRefEntity} from './database/block-execution-session-ref.entity';
import {BlockSessionEntity} from './database/block-session.entity';
import {BlockSessionMemberEntity} from './database/block-session-participant.entity';
import {SportingStateEntity} from './database/block-sporting-state.entity';
import {AttemptEntity} from './database/block-attempt.entity';
import {blockProgress} from './block-progress';
export class BlockInspectionService implements BlockInspection {
  constructor(private readonly db:TransactionService) {}
  /** Пагинация выполняется до чтения определений и дочерних данных исполнений. */
  async racePage(ownerId:string,q:{past:boolean;limit:number;after?:{at:string;id:string}}) {
    const direction=q.past?'DESC':'ASC', compare=q.past?'<':'>';
    const rows:{id:string;key:string;at:string}[]=await this.db.manager.query(`
      SELECT b.id::text,b.key,b.definition->'schedule'->>'startsAt' AS at FROM blocks b
      LEFT JOIN LATERAL (SELECT status FROM block_executions WHERE block_id=b.id ORDER BY id DESC LIMIT 1) e ON true
      WHERE b.owner_type='EVENT' AND b.owner_id=$1 AND b.definition->>'type'='RACE'
        AND (COALESCE(e.status,'PENDING') IN ('COMPLETED','FAILED','CANCELLED','SKIPPED'))=$2
        AND ($3::text IS NULL OR (b.definition->'schedule'->>'startsAt',b.id) ${compare} ($3::text,$4::bigint))
      ORDER BY b.definition->'schedule'->>'startsAt' ${direction},b.id ${direction} LIMIT $5`,
      [ownerId,q.past,q.after?.at??null,q.after?.id??null,q.limit+1]);
    const page=rows.slice(0,q.limit),last=page.at(-1);
    return {keys:page.map(row=>row.key),next:rows.length>q.limit&&last?{at:last.at,id:last.id}:null};
  }
  async calendar(ownerId:string,timezone:string,anchor:string) {
    return this.db.manager.query(
      `WITH races AS (SELECT b.key,b.definition->'game'->'track'->>'code' AS track,
        ($3::date + floor((((b.definition->'schedule'->>'startsAt')::timestamptz AT TIME ZONE $2)::date-$3::date)/7.0)::int*7) AS day,
        COALESCE(e.status,'PENDING') AS status,b.definition->'schedule'->>'startsAt' AS at
        FROM blocks b LEFT JOIN LATERAL (SELECT status FROM block_executions WHERE block_id=b.id ORDER BY id DESC LIMIT 1) e ON true
        WHERE b.owner_type='EVENT' AND b.owner_id=$1 AND b.definition->>'type'='RACE')
      SELECT day::text AS key,day::text AS start,(day+6)::text AS end,count(*)::int AS total,
        count(*) FILTER(WHERE status='COMPLETED')::int AS completed,
        count(*) FILTER(WHERE status IN ('COMPLETED','FAILED','CANCELLED','SKIPPED'))::int AS closed,
        (array_agg(track ORDER BY at))[1] AS "trackCode",(array_agg(key ORDER BY at))[1] AS "blockKey"
      FROM races GROUP BY day ORDER BY day`,[ownerId,timezone,anchor]);
  }
  async schedule(ownerId:string) {
    const [row]=await this.db.manager.query(`SELECT min(definition->'schedule'->>'startsAt') AS "startsAt",
      max(definition->'schedule'->>'estimatedEndsAt') AS "endsAt" FROM blocks WHERE owner_type='EVENT' AND owner_id=$1`,[ownerId]);
    return row?.startsAt?{...row,qualificationStartsAt:null,qualificationEndsAt:null}:null;
  }
  async participantCount(executionIds:readonly string[]) {
    if (!executionIds.length) return 0;
    const [row] = await this.db.manager.query(`SELECT COUNT(DISTINCT participant_id)::int AS count
      FROM block_execution_members WHERE execution_id=ANY($1::bigint[]) AND actual_position IS NOT NULL`, [executionIds]);
    return Number(row.count);
  }
  async participants(executionIds:readonly string[],q:{limit:number;afterId?:string;participantId?:string}) {
    const rows=await this.db.manager.query(`SELECT m.participant_id AS id,m.participant_id AS "participantId",array_agg(DISTINCT e.block_id::text) AS "blockIds"
      FROM block_execution_members m JOIN block_executions e ON e.id=m.execution_id
      WHERE m.execution_id=ANY($1::bigint[]) AND m.actual_position IS NOT NULL
        AND ($2::text IS NULL OR m.participant_id>$2) AND ($3::text IS NULL OR m.participant_id=$3)
      GROUP BY m.participant_id ORDER BY m.participant_id LIMIT $4`,[executionIds,q.afterId??null,q.participantId??null,q.limit+1]);
    return {items:rows.slice(0,q.limit),nextAfterId:rows.length>q.limit?rows[q.limit-1].id:null};
  }
  async attempts(executionId:string,q:{limit:number;afterId?:string}) {
    if(q.afterId&&BigInt(q.afterId)>2147483648n)return {items:[],nextAfterId:null};
    const rows=await this.db.manager.find(AttemptEntity,{where:{executionId,...(q.afterId?{position:MoreThan(Number(q.afterId)-1)}:{})},order:{position:'ASC'},take:q.limit+1});
    const page=rows.slice(0,q.limit);
    const nodes=blockProgress({type:'TIME_ATTACK',attempts:page.map(row=>row.attempt)});
    return {items:nodes.map((node,index)=>({...node,id:String(page[index].position+1)})),nextAfterId:rows.length>q.limit?String(page.at(-1)!.position+1):null};
  }
  async snapshot(blockIds:readonly string[],executionIds:readonly string[],details:boolean) {
    const m=this.db.manager;
    const definitions=blockIds.length?await m.findBy(BlockEntity,{id:In([...blockIds])}):[];
    const blocks=definitions.map(({id,ownerType,ownerId,definition,createdAt})=>({id,owner:{type:ownerType,id:ownerId},definition,createdAt}));
    const rows=executionIds.length?await m.findBy(ExecutionEntity,{id:In([...executionIds])}):[];
    const detailExecutionIds=rows.filter(row=>row.internalType!=='TIME_ATTACK').map(row=>row.id);
    const where={executionId:In(detailExecutionIds)};
    const members=details&&detailExecutionIds.length?await m.find(ExecutionMemberEntity,{where,order:{position:'ASC'}}):[];
    const refs=details&&detailExecutionIds.length?await m.find(ExecutionSessionRefEntity,{where,order:{position:'ASC'}}):[];
    const executions=rows.map(({definition:_,internalType:__,groupingPolicy:___,...r})=>({...r,
      owner:blocks.find(b=>b.id===r.blockId)!.owner,actualParticipantIds:members.filter(p=>p.executionId===r.id&&p.actualPosition!==null).map(p=>p.participantId),
      sessionIds:refs.filter(s=>s.executionId===r.id).map(s=>s.sessionId)}));
    const progress:Awaited<ReturnType<BlockInspection['snapshot']>>['progress']={};
    if(details&&detailExecutionIds.length) {
      const sporting=await m.findBy(SportingStateEntity,where);
      const sessions=await m.find(BlockSessionEntity,{where,order:{position:'ASC'}});
      const sessionMembers=await m.find(BlockSessionMemberEntity,{where,order:{position:'ASC'}});
      for(const r of rows) {
        const saved=sporting.find(s=>s.executionId===r.id);
        if(saved)progress[r.id]=blockProgress(saved.state);
        else if(r.internalType==='TIME_ATTACK')progress[r.id]=[];
        else if(r.internalType==='RACE')progress[r.id]=sessions.filter(s=>s.executionId===r.id).map(s=>({key:s.sessionKey,title:`Сплит ${s.splitNumber}`,status:s.phase,runtimeSessionId:s.sessionId,children:[],
          participants:sessionMembers.filter(p=>p.executionId===r.id&&p.sessionKey===s.sessionKey).map(p=>({participantId:p.participantId,displayName:members.find(x=>x.executionId===r.id&&x.participantId===p.participantId)?.participant?.identity?.displayName??'Пилот'}))}));
        else progress[r.id]=[];
      }
    }
    return {blocks,executions,progress};
  }
}
