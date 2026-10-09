
-- Development-only StrikeQuests sync storage. Never store private journal entries or credentials.
create schema if not exists sq_internal;
revoke all on schema sq_internal from public, anon, authenticated;

create function sq_internal.safe_json_keys(value jsonb, allowed text[])
returns boolean language sql immutable strict set search_path = ''
as $$
  select jsonb_typeof(value) = 'object'
   and not exists (
      select 1 from jsonb_object_keys(value) as k(key)
      where not (k.key = any(allowed))
   );
$$;

create function sq_internal.sync_record_valid(kind text, record_key text, payload jsonb)
returns boolean language plpgsql immutable set search_path = ''
as $$
declare
  allowed text[];
  source jsonb;
  snap jsonb;
begin
  if payload is null or pg_catalog.jsonb_typeof(payload) <> 'object'
     or pg_catalog.octet_length(payload::text) > 16384 then
    return false;
  end if;
  case kind
    when 'watchlist' then
      if record_key !~ '^[A-Z0-9.^_-]{1,18}$'
         or payload->>'symbol' is distinct from record_key then return false; end if;
      allowed := array['symbol','name','exchange','at','updatedAt','snapshot'];
    when 'saved_analysis' then
      if record_key !~ '^[a-zA-Z0-9_.:-]{1,80}$'
         or payload->>'id' is distinct from record_key
         or coalesce(payload->>'ticker','') !~ '^[A-Z0-9.^_-]{1,18}$' then return false; end if;
      allowed := array['id','ticker','instrument','p','c','correction','price','perf','divisor','increment','low','mid','high','at','reason','inputMode','savedOrigin','sourceContext'];
      if payload ? 'reason' and (
           pg_catalog.jsonb_typeof(payload->'reason') <> 'string'
           or pg_catalog.length(payload->>'reason') > 2000) then return false; end if;
    when 'appearance' then
      if record_key <> 'appearance'
         or coalesce(payload->>'theme','') not in ('quest','quiet') then return false; end if;
      allowed := array['theme'];
    when 'milestone' then
      if record_key not in ('first','trend','range','season','multi','saved','watch','compare','complete','review')
         or payload->>'id' is distinct from record_key then return false; end if;
      allowed := array['id','at','mode','origin'];
    when 'horizon' then
      if record_key not in ('3m','6m','1y','2y','3y')
         or payload->>'period' is distinct from record_key then return false; end if;
      allowed := array['period','at'];
    else return false;
  end case;
  if not sq_internal.safe_json_keys(payload,allowed) then return false; end if;
  if kind = 'saved_analysis' and payload ? 'sourceContext' then
    source := payload->'sourceContext';
    if pg_catalog.jsonb_typeof(source) not in ('null','object') then return false; end if;
    if pg_catalog.jsonb_typeof(source) = 'object'
       and not sq_internal.safe_json_keys(source,array['source','session','stale','synthetic'])
       then return false; end if;
  end if;
  if kind = 'watchlist' and payload ? 'snapshot' then
    snap := payload->'snapshot';
    if pg_catalog.jsonb_typeof(snap) not in ('null','object') then return false; end if;
    if pg_catalog.jsonb_typeof(snap) = 'object' then
      if not sq_internal.safe_json_keys(snap,array['symbol','price','perf','low','mid','high','period','correction','score','updatedAt','inputMode','savedOrigin','sourceContext','returnPct','high52','low52']) then return false; end if;
      source := snap->'sourceContext';
      if source is not null and pg_catalog.jsonb_typeof(source) not in ('null','object') then return false; end if;
      if pg_catalog.jsonb_typeof(source) = 'object'
         and not sq_internal.safe_json_keys(source,array['source','session','stale','synthetic'])
         then return false; end if;
    end if;
  end if;
  return true;
end;
$$;

create table public.sq_sync_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('watchlist','saved_analysis','appearance','milestone','horizon')),
  record_key text not null check(pg_catalog.length(record_key) between 1 and 80),
  payload jsonb,
  deleted boolean not null default false,
  revision bigint not null default 1 check(revision between 1 and 2147483647),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,kind,record_key),
  constraint sq_sync_records_payload_check
    check ((deleted and payload is null) or (not deleted and sq_internal.sync_record_valid(kind,record_key,payload)))
);
comment on table public.sq_sync_records is 'Development-only typed, owner-private sync projections. Private Research Check-in journal must never be uploaded.';

create function sq_internal.enforce_sync_revision()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.kind is distinct from old.kind
     or new.record_key is distinct from old.record_key
     or new.created_at is distinct from old.created_at
     or new.revision <> old.revision + 1 then
    raise exception 'Sync record identity or revision conflict' using errcode = '23514';
  end if;
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;
create trigger sq_sync_revision_guard before update on public.sq_sync_records
  for each row execute function sq_internal.enforce_sync_revision();

alter table public.sq_sync_records enable row level security;
revoke all on public.sq_sync_records from public,anon,authenticated;
grant select,insert,update,delete on public.sq_sync_records to authenticated;

create policy sq_select_own on public.sq_sync_records for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy sq_insert_own on public.sq_sync_records for insert to authenticated
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy sq_update_own on public.sq_sync_records for update to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy sq_delete_own on public.sq_sync_records for delete to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- Helpers are validation/trigger internals, not externally exposed RPC functions.
revoke all on all functions in schema sq_internal from public, anon, authenticated;
