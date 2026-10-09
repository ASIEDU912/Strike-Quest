grant usage on schema sq_internal to authenticated;
grant execute on function sq_internal.safe_json_keys(jsonb,text[]) to authenticated;
grant execute on function sq_internal.sync_record_valid(text,text,jsonb) to authenticated;
