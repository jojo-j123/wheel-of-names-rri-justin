-- RRI Event Wheel cloud sync (Supabase).
-- Same rules as the old /api server: optimistic concurrency (base stamp), tombstones for deletes,
-- newest-wins, plus a per-document history (last 10 versions) so data can always be recovered.
-- Safe to run more than once.

create sequence if not exists public.wheel_change_seq;

create table if not exists public.wheel_docs (
  kind text not null check (kind in ('events', 'templates')),
  id text not null check (id ~ '^[A-Za-z0-9_-]{6,100}$'),
  doc jsonb not null,
  stamp bigint not null,
  seq bigint not null default nextval('public.wheel_change_seq'),
  saved_at timestamptz not null default now(),
  primary key (kind, id)
);

create table if not exists public.wheel_tombstones (
  kind text not null check (kind in ('events', 'templates')),
  id text not null,
  deleted_at bigint not null,
  seq bigint not null default nextval('public.wheel_change_seq'),
  primary key (kind, id)
);

create table if not exists public.wheel_history (
  history_id bigserial primary key,
  kind text not null,
  id text not null,
  doc jsonb not null,
  stamp bigint not null,
  replaced_at timestamptz not null default now(),
  reason text not null
);
create index if not exists wheel_history_doc on public.wheel_history (kind, id, history_id desc);

-- No policies: browsers can only use the functions below, never the tables directly.
alter table public.wheel_docs enable row level security;
alter table public.wheel_tombstones enable row level security;
alter table public.wheel_history enable row level security;

create or replace function public.wheel_keep_history(p_kind text, p_id text, p_doc jsonb, p_stamp bigint, p_reason text)
returns void language sql security definer set search_path = public as $$
  insert into wheel_history (kind, id, doc, stamp, reason) values (p_kind, p_id, p_doc, p_stamp, p_reason);
  delete from wheel_history h where h.kind = p_kind and h.id = p_id and h.history_id not in (
    select history_id from wheel_history where kind = p_kind and id = p_id order by history_id desc limit 10);
$$;

create or replace function public.wheel_save(p_kind text, p_id text, p_doc jsonb, p_base bigint default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_stamp bigint;
  v_now bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_cur record;
  v_found boolean;
  v_tomb bigint;
begin
  if p_kind not in ('events', 'templates') or p_id !~ '^[A-Za-z0-9_-]{6,100}$' then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'invalid id');
  end if;
  if octet_length(p_doc::text) > 4 * 1024 * 1024 then
    return jsonb_build_object('ok', false, 'status', 413, 'error', 'too large');
  end if;
  if jsonb_typeof(p_doc) <> 'object' or p_doc->>'id' is distinct from p_id then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'invalid document');
  end if;
  if p_kind = 'events' and jsonb_typeof(p_doc->'participants') is distinct from 'array' then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'invalid event');
  end if;
  begin
    v_stamp := floor((p_doc->>(case when p_kind = 'events' then 'updatedAt' else 'createdAt' end))::numeric)::bigint;
  exception when others then v_stamp := null;
  end;
  if v_stamp is null or v_stamp <= 0 or v_stamp > v_now + 86400000 then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'invalid timestamp');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_kind || ':' || p_id));
  select deleted_at into v_tomb from wheel_tombstones where kind = p_kind and id = p_id;
  if v_tomb is not null and v_tomb >= v_stamp then
    return jsonb_build_object('ok', false, 'status', 409, 'reason', 'deleted');
  end if;
  select doc, stamp into v_cur from wheel_docs where kind = p_kind and id = p_id;
  v_found := found;
  if v_found and v_cur.stamp = v_stamp then
    return jsonb_build_object('ok', true, 'stamp', v_stamp);
  end if;
  if p_base is not null and (case when v_found then v_cur.stamp else 0 end) <> p_base then
    return jsonb_build_object('ok', false, 'status', 409, 'reason', 'stale', 'newerStamp', case when v_found then v_cur.stamp end);
  end if;
  if v_found and v_cur.stamp > v_stamp then
    return jsonb_build_object('ok', false, 'status', 409, 'reason', 'stale', 'newerStamp', v_cur.stamp);
  end if;
  if v_found then
    perform wheel_keep_history(p_kind, p_id, v_cur.doc, v_cur.stamp, 'replaced');
  end if;
  insert into wheel_docs (kind, id, doc, stamp) values (p_kind, p_id, p_doc, v_stamp)
  on conflict (kind, id) do update set doc = excluded.doc, stamp = excluded.stamp,
    seq = nextval('public.wheel_change_seq'), saved_at = now();
  return jsonb_build_object('ok', true, 'stamp', v_stamp);
end;
$$;

create or replace function public.wheel_delete(p_kind text, p_id text, p_at bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cur record;
  v_at bigint := case when p_at is null or p_at <= 0 then (extract(epoch from clock_timestamp()) * 1000)::bigint else p_at end;
begin
  if p_kind not in ('events', 'templates') or p_id !~ '^[A-Za-z0-9_-]{6,100}$' then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'invalid id');
  end if;
  perform pg_advisory_xact_lock(hashtext(p_kind || ':' || p_id));
  insert into wheel_tombstones (kind, id, deleted_at) values (p_kind, p_id, v_at)
  on conflict (kind, id) do update set deleted_at = greatest(wheel_tombstones.deleted_at, excluded.deleted_at),
    seq = nextval('public.wheel_change_seq');
  select doc, stamp into v_cur from wheel_docs where kind = p_kind and id = p_id;
  if found then
    perform wheel_keep_history(p_kind, p_id, v_cur.doc, v_cur.stamp, 'deleted');
    delete from wheel_docs where kind = p_kind and id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Cheap change counter: devices poll this and only download everything when something changed.
create or replace function public.wheel_version()
returns bigint language sql stable security definer set search_path = public as $$
  select greatest(coalesce((select max(seq) from wheel_docs), 0), coalesce((select max(seq) from wheel_tombstones), 0));
$$;

create or replace function public.wheel_state()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'events', coalesce((select jsonb_agg(doc order by id) from wheel_docs where kind = 'events'), '[]'::jsonb),
    'deletedEvents', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'deletedAt', deleted_at)) from wheel_tombstones where kind = 'events'), '[]'::jsonb),
    'templates', coalesce((select jsonb_agg(doc order by id) from wheel_docs where kind = 'templates'), '[]'::jsonb),
    'deletedTemplates', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'deletedAt', deleted_at)) from wheel_tombstones where kind = 'templates'), '[]'::jsonb),
    'serverTime', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'version', public.wheel_version()
  );
$$;

-- Only the four public functions are callable from the browser.
revoke execute on function public.wheel_keep_history(text, text, jsonb, bigint, text) from public, anon, authenticated;
revoke execute on function public.wheel_save(text, text, jsonb, bigint) from public;
revoke execute on function public.wheel_delete(text, text, bigint) from public;
revoke execute on function public.wheel_version() from public;
revoke execute on function public.wheel_state() from public;
grant execute on function public.wheel_save(text, text, jsonb, bigint) to anon, authenticated;
grant execute on function public.wheel_delete(text, text, bigint) to anon, authenticated;
grant execute on function public.wheel_version() to anon, authenticated;
grant execute on function public.wheel_state() to anon, authenticated;

-- Images: public bucket, content-addressed paths (sha256), images only, 10 MB max.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wheel-images', 'wheel-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'wheel images upload') then
    create policy "wheel images upload" on storage.objects for insert to anon, authenticated
      with check (bucket_id = 'wheel-images' and name ~ '^[0-9a-f]{64}\.(jpg|png|webp|svg)$');
  end if;
end $$;
