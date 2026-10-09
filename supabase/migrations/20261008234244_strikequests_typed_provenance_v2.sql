-- Development-only: preserve typed research provenance without accepting journal fields.
-- Every helper remains SECURITY INVOKER in the non-exposed internal schema.
create function sq_internal.sync_date_valid(value text)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if value is null or value !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  return pg_catalog.to_char(value::date,'YYYY-MM-DD')=value;
exception when others then return false;
end;
$$;

create function sq_internal.sync_time_valid(value text)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if value is null or pg_catalog.length(value)>80
    or value !~ '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$'
    or not sq_internal.sync_date_valid(pg_catalog.left(value,10)) then return false; end if;
  perform value::timestamptz;
  return true;
exception when others then return false;
end;
$$;

create function sq_internal.sync_fields_valid(value jsonb, types jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item record; code text; raw text;
begin
  if value is null or pg_catalog.jsonb_typeof(value)<>'object' then return false; end if;
  for item in select * from pg_catalog.jsonb_each(value) loop
    if not (types ? item.key) then return false; end if;
    code:=types->>item.key;
    if pg_catalog.jsonb_typeof(item.value)='null' then continue; end if;
    raw:=item.value#>>'{}';
    if code='number' then
      if pg_catalog.jsonb_typeof(item.value)<>'number' then return false; end if;
      if pg_catalog.abs(raw::numeric)>1e15 then return false; end if;
    elsif code='boolean' then
      if pg_catalog.jsonb_typeof(item.value)<>'boolean' then return false; end if;
    elsif code='object' then
      if pg_catalog.jsonb_typeof(item.value)<>'object' then return false; end if;
    else
      if pg_catalog.jsonb_typeof(item.value)<>'string' then return false; end if;
      if code like 'string:%' then
        if pg_catalog.length(raw)>pg_catalog.split_part(code,':',2)::integer then return false; end if;
      elsif code='date' then
        if not sq_internal.sync_date_valid(raw) then return false; end if;
      elsif code='time' then
        if not sq_internal.sync_time_valid(raw) then return false; end if;
      elsif code='symbol' then
        if raw !~ '^[A-Z0-9.^_-]{1,18}$' then return false; end if;
      elsif code='period' then
        if raw not in ('3m','6m','1y','2y','3y') then return false; end if;
      elsif code='mode' then
        if raw not in ('manual','demo','auto_eod') then return false; end if;
      elsif code='trend' then
        if raw not in ('Up','Down','Flat') then return false; end if;
      else return false;
      end if;
    end if;
  end loop;
  return true;
end;
$$;

create function sq_internal.sync_source_valid(value jsonb, ticker text)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if value is null or pg_catalog.jsonb_typeof(value)='null' then return true; end if;
  if not sq_internal.sync_fields_valid(value,'{"source":"string:160","session":"date","fetchedAt":"number","stale":"boolean","synthetic":"boolean","symbol":"symbol","baselineOffset":"number","issue":"string:1000","coverage":"object"}') then return false; end if;
  if value->>'symbol' is not null and value->>'symbol' is distinct from ticker then return false; end if;
  if pg_catalog.jsonb_typeof(value->'coverage')='object' and not sq_internal.sync_fields_valid(value->'coverage','{"fullRange":"boolean","monthlyGaps":"number","weeklyGaps":"number","weeklyPoints":"number","monthlyRows":"number"}') then return false; end if;
  return true;
end;
$$;

create or replace function sq_internal.sync_record_valid(kind text, record_key text, payload jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare snap jsonb; ticker text;
begin
  if payload is null or pg_catalog.jsonb_typeof(payload)<>'object' or pg_catalog.octet_length(payload::text)>16384 then return false; end if;
  case kind
    when 'watchlist' then
      if record_key !~ '^[A-Z0-9.^_-]{1,18}$' or pg_catalog.jsonb_typeof(payload->'symbol') is distinct from 'string' or payload->>'symbol' is distinct from record_key then return false; end if;
      if not sq_internal.sync_fields_valid(payload,'{"symbol":"symbol","name":"string:160","exchange":"string:80","at":"time","updatedAt":"time","snapshot":"object"}') then return false; end if;
      snap:=payload->'snapshot';
      if pg_catalog.jsonb_typeof(snap)='object' then
        if not sq_internal.sync_fields_valid(snap,'{"symbol":"symbol","price":"number","perf":"number","low":"number","mid":"number","high":"number","period":"period","correction":"number","score":"number","updatedAt":"time","inputMode":"mode","savedOrigin":"string:40","sourceContext":"object","returnPct":"number","high52":"number","low52":"number"}') then return false; end if;
        if snap->>'symbol' is not null and snap->>'symbol' is distinct from record_key then return false; end if;
        if not sq_internal.sync_source_valid(snap->'sourceContext',record_key) then return false; end if;
      end if;
    when 'saved_analysis' then
      ticker:=payload->>'ticker';
      if record_key !~ '^[a-zA-Z0-9_.:-]{1,80}$' or pg_catalog.jsonb_typeof(payload->'id') is distinct from 'string' or payload->>'id' is distinct from record_key or pg_catalog.jsonb_typeof(payload->'ticker') is distinct from 'string' or ticker !~ '^[A-Z0-9.^_-]{1,18}$' then return false; end if;
      if not sq_internal.sync_fields_valid(payload,'{"id":"string:80","ticker":"symbol","instrument":"string:100","p":"period","c":"number","correction":"number","price":"number","perf":"number","divisor":"number","increment":"number","low":"number","mid":"number","high":"number","at":"time","reason":"string:2000","inputMode":"mode","savedOrigin":"string:40","sourceContext":"object","researchContext":"object"}') then return false; end if;
      if not sq_internal.sync_source_valid(payload->'sourceContext',ticker) then return false; end if;
      if pg_catalog.jsonb_typeof(payload->'researchContext')='object' and not sq_internal.sync_fields_valid(payload->'researchContext','{"baselineDate":"date","baselineClose":"number","trend1m":"trend","trend3m":"trend","low52":"number","high52":"number","sampleMonths":"number"}') then return false; end if;
    when 'appearance' then
      if record_key<>'appearance' or payload->>'theme' is null or payload->>'theme' not in ('quest','quiet') or not sq_internal.safe_json_keys(payload,array['theme']) then return false; end if;
    when 'milestone' then
      if record_key not in ('first','trend','range','season','multi','saved','watch','compare','complete','review') or pg_catalog.jsonb_typeof(payload->'id') is distinct from 'string' or payload->>'id' is distinct from record_key or payload->>'at' is null or not sq_internal.sync_fields_valid(payload,'{"id":"string:80","at":"time","mode":"string:80","origin":"string:80"}') then return false; end if;
    when 'horizon' then
      if record_key not in ('3m','6m','1y','2y','3y') or pg_catalog.jsonb_typeof(payload->'period') is distinct from 'string' or payload->>'period' is distinct from record_key or not sq_internal.sync_fields_valid(payload,'{"period":"period","at":"time"}') then return false; end if;
    else return false;
  end case;
  return true;
end;
$$;

revoke all on function sq_internal.sync_date_valid(text),sq_internal.sync_time_valid(text),sq_internal.sync_fields_valid(jsonb,jsonb),sq_internal.sync_source_valid(jsonb,text) from public,anon,authenticated;
grant execute on function sq_internal.sync_date_valid(text),sq_internal.sync_time_valid(text),sq_internal.sync_fields_valid(jsonb,jsonb),sq_internal.sync_source_valid(jsonb,text) to authenticated;
-- CREATE OR REPLACE preserves the validator's existing authenticated-only grant.
