-- Development-only RLS regression. All generated fixtures roll back.
-- This verifies database authorization, not provider sign-in or email delivery.
begin;
do $test$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  touched integer;
begin
  insert into auth.users(id,email,aud,role)
    values(user_a,'sq-fixture-a-'||user_a||'@example.invalid','authenticated','authenticated'),
          (user_b,'sq-fixture-b-'||user_b||'@example.invalid','authenticated','authenticated');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',user_a,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  insert into public.sq_sync_records(user_id,kind,record_key,payload)
    values(user_a,'watchlist','SQFIX','{"symbol":"SQFIX","name":"Synthetic isolation fixture","snapshot":null}');
  select count(*) into touched from public.sq_sync_records where record_key='SQFIX';
  if touched<>1 then raise exception 'Owner read failed'; end if;
  update public.sq_sync_records set revision=2,payload='{"symbol":"SQFIX","name":"Synthetic updated fixture"}'
    where user_id=user_a and kind='watchlist' and record_key='SQFIX' and revision=1;
  get diagnostics touched=row_count;
  if touched<>1 then raise exception 'Owner update failed'; end if;
  -- A mixed upsert is one statement: a stale row must roll back its new companion.
  begin
    insert into public.sq_sync_records(user_id,kind,record_key,payload,revision,created_at)
      values(user_a,'watchlist','SQFIX','{"symbol":"SQFIX","name":"Stale batch overwrite"}',2,
               (select created_at from public.sq_sync_records where record_key='SQFIX')),
            (user_a,'watchlist','SQATOMIC','{"symbol":"SQATOMIC"}',1,now())
      on conflict(user_id,kind,record_key) do update
        set payload=excluded.payload,revision=excluded.revision,created_at=excluded.created_at;
    raise exception 'Stale mixed batch was allowed';
  exception when check_violation then null;
  end;
  select count(*) into touched from public.sq_sync_records where record_key='SQATOMIC';
  if touched<>0 then raise exception 'Stale batch partially inserted'; end if;
  insert into public.sq_sync_records(user_id,kind,record_key,payload)
    values(user_a,'saved_analysis','typed-fixture','{"id":"typed-fixture","ticker":"SQFIX","inputMode":"demo","sourceContext":{"source":"Synthetic fixture","symbol":"SQFIX","session":"2026-10-07","synthetic":true,"stale":true,"fetchedAt":1791374400000,"coverage":{"fullRange":false,"weeklyGaps":2}},"researchContext":{"baselineDate":"2024-10-07","baselineClose":80,"trend1m":"Up","sampleMonths":12}}');
  if not exists(select 1 from public.sq_sync_records where record_key='typed-fixture' and payload#>>'{sourceContext,coverage,weeklyGaps}'='2') then raise exception 'Typed provenance did not round-trip'; end if;
  begin
    insert into public.sq_sync_records(user_id,kind,record_key,payload)
      values(user_a,'watchlist','SQTYPE','{"symbol":"SQTYPE","name":{"journal":"SYNTHETIC_PRIVATE_SENTINEL"}}');
    raise exception 'Mistyped allowed field was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.sq_sync_records(user_id,kind,record_key,payload)
      values(user_a,'saved_analysis','bad-coverage','{"id":"bad-coverage","ticker":"SQFIX","sourceContext":{"coverage":{"journal":"SYNTHETIC_PRIVATE_SENTINEL"}}}');
    raise exception 'Unexpected nested source field was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.sq_sync_records(user_id,kind,record_key,payload)
      values(user_b,'watchlist','SQFIX','{"symbol":"SQFIX"}');
    raise exception 'Cross-user insert was allowed';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',user_b,'role','authenticated')::text,true);
  select count(*) into touched from public.sq_sync_records where user_id=user_a;
  if touched<>0 then raise exception 'Cross-user read leaked'; end if;
  update public.sq_sync_records set revision=3 where user_id=user_a;
  get diagnostics touched=row_count;
  if touched<>0 then raise exception 'Cross-user update was allowed'; end if;
  delete from public.sq_sync_records where user_id=user_a;
  get diagnostics touched=row_count;
  if touched<>0 then raise exception 'Cross-user delete was allowed'; end if;
  insert into public.sq_sync_records(user_id,kind,record_key,payload)
    values(user_b,'watchlist','SQFIX','{"symbol":"SQFIX"}');
  begin
    update public.sq_sync_records set user_id=user_a,revision=2 where user_id=user_b;
    raise exception 'Ownership reassignment was allowed';
  exception when insufficient_privilege or check_violation then null;
  end;
  begin
    update public.sq_sync_records set payload='{"symbol":"SQFIX","name":"Stale overwrite"}' where user_id=user_b;
    raise exception 'Unchanged revision was allowed';
  exception when check_violation then null;
  end;
  begin
    insert into public.sq_sync_records(user_id,kind,record_key,payload)
      values(user_b,'watchlist','SQPRIVATE','{"symbol":"SQPRIVATE","checkinReason":"SYNTHETIC_PRIVATE_SENTINEL"}');
    raise exception 'Private journal field was allowed';
  exception when check_violation then null;
  end;
  begin
    insert into public.sq_sync_records(user_id,kind,record_key,payload)
      values(user_b,'watchlist','SQNEST','{"symbol":"SQNEST","snapshot":{"journal":"SYNTHETIC_PRIVATE_SENTINEL"}}');
    raise exception 'Nested private journal field was allowed';
  exception when check_violation then null;
  end;
  begin
    insert into public.sq_sync_records(user_id,kind,record_key,payload)
      values(user_b,'journal','SQJOURNAL','{}');
    raise exception 'Private journal category was allowed';
  exception when check_violation then null;
  end;
  update public.sq_sync_records set revision=2,deleted=true,payload=null where user_id=user_b;
  get diagnostics touched=row_count;
  if touched<>1 then raise exception 'Owner tombstone failed'; end if;
  update public.sq_sync_records set revision=2,deleted=false,payload='{"symbol":"SQFIX"}'
    where user_id=user_b and revision=1;
  get diagnostics touched=row_count;
  if touched<>0 then raise exception 'Stale conditional write was allowed'; end if;
  perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
  select count(*) into touched from public.sq_sync_records;
  if touched<>0 then raise exception 'Missing identity read leaked'; end if;
  begin
    insert into public.sq_sync_records(user_id,kind,record_key,payload)
      values(user_b,'watchlist','SQNULL','{"symbol":"SQNULL"}');
    raise exception 'Missing identity insert was allowed';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  execute 'set local role anon';
  begin
    perform 1 from public.sq_sync_records;
    raise exception 'Anonymous table access was allowed';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end;
$test$;
select 'PASS: owner CRUD, cross-user denial, immutable ownership, atomic stale-batch rollback, typed provenance round-trip, private field/category/type rejection, tombstones and anonymous/missing identity denial; fixtures roll back' as result;
rollback;
