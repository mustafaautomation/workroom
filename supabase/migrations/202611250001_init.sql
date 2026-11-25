-- Workroom: agencies, clients, projects, approvals, invoices.
-- Roles live in profiles, never in user_metadata.
-- Authenticated users can select rows allowed by RLS. Writes go through the functions below.

create schema if not exists private;

create table public.agencies (
  id text primary key,
  slug text not null unique,
  name text not null,
  logo_text text not null,
  logo_url text,
  brand_color text not null,
  plan text not null check (plan in ('starter', 'pro')),
  plan_status text not null check (plan_status in ('active', 'trialing', 'canceled')),
  trial_ends_at timestamptz
);

create table public.clients (
  id text primary key,
  agency_id text not null references public.agencies (id) on delete cascade,
  name text not null,
  website text not null default ''
);

create table public.profiles (
  id text primary key,
  email text not null unique,
  name text not null,
  role text not null check (role in ('super_admin', 'agency_owner', 'team_member', 'client')),
  agency_id text references public.agencies (id) on delete cascade,
  client_id text references public.clients (id) on delete set null,
  title text not null default ''
);

create table public.projects (
  id text primary key,
  agency_id text not null references public.agencies (id) on delete cascade,
  client_id text not null references public.clients (id) on delete cascade,
  name text not null,
  summary text not null default '',
  status text not null check (status in ('active', 'paused', 'completed')),
  due_date date not null
);

create table public.milestones (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  name text not null,
  due_date date not null,
  position integer not null default 1
);

create table public.tasks (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  milestone_id text not null references public.milestones (id) on delete cascade,
  title text not null,
  status text not null check (status in ('backlog', 'in_progress', 'review', 'done')),
  client_visible boolean not null default true,
  assignee_id text references public.profiles (id) on delete set null
);

create table public.files (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  agency_id text not null references public.agencies (id) on delete cascade,
  name text not null,
  filename text not null,
  version text not null,
  bytes integer not null,
  mime text not null,
  uploaded_by text not null references public.profiles (id),
  uploaded_at timestamptz not null default now(),
  storage_path text not null
);

create table public.deliverables (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  agency_id text not null references public.agencies (id) on delete cascade,
  title text not null,
  summary text not null default '',
  status text not null check (status in ('pending', 'approved', 'changes_requested')),
  version text not null,
  file_id text references public.files (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.comments (
  id text primary key,
  deliverable_id text not null references public.deliverables (id) on delete cascade,
  author_id text not null references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.invoices (
  id text primary key,
  agency_id text not null references public.agencies (id) on delete cascade,
  client_id text not null references public.clients (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  number text not null,
  status text not null check (status in ('open', 'paid', 'void')),
  issued_on date not null,
  due_date date not null,
  lines jsonb not null
);

create table public.notifications (
  id text primary key,
  user_id text not null references public.profiles (id) on delete cascade,
  agency_id text not null references public.agencies (id) on delete cascade,
  title text not null,
  body text not null,
  href text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.emails (
  id text primary key,
  agency_id text not null references public.agencies (id) on delete cascade,
  to_email text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index projects_agency_idx on public.projects (agency_id, client_id);
create index tasks_project_idx on public.tasks (project_id, status);
create index deliverables_project_idx on public.deliverables (project_id, status);
create index comments_deliverable_idx on public.comments (deliverable_id);
create index invoices_agency_idx on public.invoices (agency_id, status);
create index notifications_user_idx on public.notifications (user_id, read);
create index files_project_idx on public.files (project_id);
create index profiles_agency_idx on public.profiles (agency_id);

create or replace function private.actor_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()::text
$$;

create or replace function private.actor_agency()
returns text language sql stable security definer set search_path = public as $$
  select agency_id from public.profiles where id = auth.uid()::text
$$;

create or replace function private.actor_client()
returns text language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid()::text
$$;

create or replace function private.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(private.actor_role() = 'super_admin', false)
$$;

create or replace function private.can_access_project(p_project_id text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
  v_agency text;
  v_client text;
  v_project public.projects;
begin
  if auth.uid() is null then return false; end if;
  select role, agency_id, client_id into v_role, v_agency, v_client from public.profiles where id = auth.uid()::text;
  if v_role is null then return false; end if;
  if v_role = 'super_admin' then return true; end if;
  select * into v_project from public.projects where id = p_project_id;
  if v_project.id is null then return false; end if;
  if v_project.agency_id is distinct from v_agency then return false; end if;
  if v_role = 'client' then return v_project.client_id = v_client; end if;
  return v_role in ('agency_owner', 'team_member');
end;
$$;

create or replace function private.can_edit_project(p_project_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select private.can_access_project(p_project_id)
    and private.actor_role() in ('agency_owner', 'team_member', 'super_admin')
$$;

create or replace function private.notify_users(p_user_ids text[], p_agency text, p_title text, p_body text, p_href text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid text;
begin
  foreach uid in array p_user_ids loop
    insert into public.notifications (id, user_id, agency_id, title, body, href, read, created_at)
    values ('ntf_' || gen_random_uuid(), uid, p_agency, p_title, left(p_body, 500), p_href, false, now());
    insert into public.emails (id, agency_id, to_email, subject, body, created_at)
    select 'em_' || gen_random_uuid(), p_agency, email, p_title, p_body, now()
    from public.profiles where id = uid;
  end loop;
end;
$$;

alter table public.agencies enable row level security;
alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.files enable row level security;
alter table public.deliverables enable row level security;
alter table public.comments enable row level security;
alter table public.invoices enable row level security;
alter table public.notifications enable row level security;
alter table public.emails enable row level security;

alter table public.agencies force row level security;
alter table public.clients force row level security;
alter table public.profiles force row level security;
alter table public.projects force row level security;
alter table public.milestones force row level security;
alter table public.tasks force row level security;
alter table public.files force row level security;
alter table public.deliverables force row level security;
alter table public.comments force row level security;
alter table public.invoices force row level security;
alter table public.notifications force row level security;
alter table public.emails force row level security;

create policy agencies_select on public.agencies for select to authenticated
using (private.is_super_admin() or id = private.actor_agency());

create policy clients_select on public.clients for select to authenticated
using (
  private.is_super_admin()
  or (agency_id = private.actor_agency() and private.actor_role() in ('agency_owner', 'team_member'))
  or (agency_id = private.actor_agency() and private.actor_role() = 'client' and id = private.actor_client())
);

create policy profiles_select on public.profiles for select to authenticated
using (
  id = auth.uid()::text
  or private.is_super_admin()
  or (agency_id = private.actor_agency() and private.actor_role() in ('agency_owner', 'team_member'))
  or (agency_id = private.actor_agency() and private.actor_role() = 'client' and role <> 'client')
  or (agency_id = private.actor_agency() and private.actor_role() = 'client' and client_id = private.actor_client())
);

create policy projects_select on public.projects for select to authenticated
using (private.can_access_project(id));

create policy milestones_select on public.milestones for select to authenticated
using (private.can_access_project(project_id));

create policy tasks_select on public.tasks for select to authenticated
using (
  private.can_access_project(project_id)
  and (private.actor_role() <> 'client' or client_visible)
);

create policy files_select on public.files for select to authenticated
using (private.can_access_project(project_id));

create policy deliverables_select on public.deliverables for select to authenticated
using (private.can_access_project(project_id));

create policy comments_select on public.comments for select to authenticated
using (
  exists (
    select 1 from public.deliverables d
    where d.id = comments.deliverable_id and private.can_access_project(d.project_id)
  )
);

create policy invoices_select on public.invoices for select to authenticated
using (
  private.is_super_admin()
  or (
    agency_id = private.actor_agency()
    and (
      private.actor_role() in ('agency_owner', 'team_member')
      or (private.actor_role() = 'client' and client_id = private.actor_client())
    )
  )
);

create policy notifications_select on public.notifications for select to authenticated
using (user_id = auth.uid()::text or private.is_super_admin());

create policy emails_select on public.emails for select to authenticated
using (
  private.is_super_admin()
  or (agency_id = private.actor_agency() and private.actor_role() in ('agency_owner', 'team_member'))
);

revoke all on all tables in schema public from public, anon, authenticated;
grant select on all tables in schema public to authenticated;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public;
grant execute on function private.actor_role() to authenticated;
grant execute on function private.actor_agency() to authenticated;
grant execute on function private.actor_client() to authenticated;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.can_access_project(text) to authenticated;
grant execute on function private.can_edit_project(text) to authenticated;

create or replace function public.decide_deliverable(p_id text, p_decision text, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role text; v_agency text; v_client text; v_project text; v_title text; v_slug text;
begin
  if auth.uid() is null then raise exception 'not_found'; end if;
  if p_decision not in ('approved', 'changes_requested') then raise exception 'not_found'; end if;
  if p_decision = 'changes_requested' and length(trim(coalesce(p_comment, ''))) < 2 then raise exception 'comment_required'; end if;
  select role, agency_id, client_id into v_role, v_agency, v_client from public.profiles where id = auth.uid()::text;
  if v_role <> 'client' then raise exception 'not_found'; end if;
  select d.project_id, d.title into v_project, v_title from public.deliverables d
    join public.projects p on p.id = d.project_id
    where d.id = p_id and p.agency_id = v_agency and p.client_id = v_client;
  if v_project is null then raise exception 'not_found'; end if;
  update public.deliverables set status = p_decision, updated_at = now() where id = p_id;
  if length(trim(coalesce(p_comment, ''))) > 0 then
    insert into public.comments (id, deliverable_id, author_id, body)
    values ('cmt_' || gen_random_uuid(), p_id, auth.uid()::text, left(trim(p_comment), 2000));
  end if;
  select slug into v_slug from public.agencies where id = v_agency;
  perform private.notify_users(
    array(select id from public.profiles where agency_id = v_agency and role in ('agency_owner', 'team_member')),
    v_agency,
    case when p_decision = 'approved' then v_title || ' approved' else 'Changes requested on ' || v_title end,
    coalesce(nullif(trim(p_comment), ''), v_title || ' was approved.'),
    '/w/' || v_slug || '/projects/' || v_project
  );
end;
$$;

create or replace function public.add_comment(p_deliverable_id text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_project text; v_agency text; v_client text; v_title text; v_slug text; v_role text;
begin
  if auth.uid() is null or length(trim(coalesce(p_body, ''))) < 2 then raise exception 'not_found'; end if;
  if not exists (
    select 1 from public.deliverables d where d.id = p_deliverable_id and private.can_access_project(d.project_id)
  ) then raise exception 'not_found'; end if;
  insert into public.comments (id, deliverable_id, author_id, body)
  values ('cmt_' || gen_random_uuid(), p_deliverable_id, auth.uid()::text, left(trim(p_body), 2000));
  select d.project_id, d.agency_id, d.title, p.client_id, a.slug, pr.role
    into v_project, v_agency, v_title, v_client, v_slug, v_role
  from public.deliverables d
  join public.projects p on p.id = d.project_id
  join public.agencies a on a.id = d.agency_id
  join public.profiles pr on pr.id = auth.uid()::text
  where d.id = p_deliverable_id;
  if v_role = 'client' then
    perform private.notify_users(array(select id from public.profiles where agency_id = v_agency and role in ('agency_owner', 'team_member')), v_agency, 'New comment on ' || v_title, trim(p_body), '/w/' || v_slug || '/projects/' || v_project);
  else
    perform private.notify_users(array(select id from public.profiles where client_id = v_client and role = 'client'), v_agency, 'New comment on ' || v_title, trim(p_body), '/w/' || v_slug || '/projects/' || v_project);
  end if;
end;
$$;

create or replace function public.resubmit_deliverable(p_id text, p_version text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_project text; v_agency text; v_client text; v_title text; v_slug text;
begin
  if not private.can_edit_project((select project_id from public.deliverables where id = p_id)) then raise exception 'not_found'; end if;
  if length(trim(coalesce(p_version, ''))) < 2 then raise exception 'not_found'; end if;
  update public.deliverables set status = 'pending', version = left(trim(p_version), 20), updated_at = now() where id = p_id
  returning project_id, agency_id, title into v_project, v_agency, v_title;
  select client_id into v_client from public.projects where id = v_project;
  select slug into v_slug from public.agencies where id = v_agency;
  perform private.notify_users(array(select id from public.profiles where client_id = v_client and role = 'client'), v_agency, v_title || ' is ready for another look', trim(p_version), '/w/' || v_slug || '/projects/' || v_project);
end;
$$;

create or replace function public.set_task_status(p_task_id text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_project text;
begin
  if p_status not in ('backlog', 'in_progress', 'review', 'done') then raise exception 'not_found'; end if;
  select project_id into v_project from public.tasks where id = p_task_id;
  if not private.can_edit_project(v_project) then raise exception 'not_found'; end if;
  update public.tasks set status = p_status where id = p_task_id;
end;
$$;

create or replace function public.create_project(p_client_id text, p_name text, p_summary text, p_due_date date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role text; v_agency text; v_plan text; v_status text; v_project text; v_milestone text;
begin
  select role, agency_id into v_role, v_agency from public.profiles where id = auth.uid()::text;
  if v_role not in ('agency_owner', 'team_member', 'super_admin') then raise exception 'not_found'; end if;
  if v_role <> 'super_admin' and not exists (select 1 from public.clients where id = p_client_id and agency_id = v_agency) then raise exception 'not_found'; end if;
  select plan, plan_status into v_plan, v_status from public.agencies where id = coalesce(v_agency, (select agency_id from public.clients where id = p_client_id));
  if v_status = 'canceled' then raise exception 'canceled'; end if;
  if v_plan = 'starter' and (select count(*) from public.projects where agency_id = v_agency and status = 'active') >= 3 then raise exception 'starter_limit'; end if;
  v_project := 'prj_' || substr(gen_random_uuid()::text, 1, 8);
  v_milestone := 'ms_' || substr(gen_random_uuid()::text, 1, 8);
  insert into public.projects (id, agency_id, client_id, name, summary, status, due_date)
  values (v_project, (select agency_id from public.clients where id = p_client_id), p_client_id, left(trim(p_name), 80), left(coalesce(p_summary, ''), 400), 'active', p_due_date);
  insert into public.milestones (id, project_id, name, due_date, position) values (v_milestone, v_project, 'Kickoff', p_due_date, 1);
  insert into public.tasks (id, project_id, milestone_id, title, status, client_visible, assignee_id)
  values ('t_' || substr(gen_random_uuid()::text, 1, 8), v_project, v_milestone, 'Kickoff notes', 'backlog', true, auth.uid()::text);
end;
$$;

create or replace function public.update_brand(p_agency_id text, p_name text, p_brand_color text, p_logo_text text, p_logo_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (private.is_super_admin() or (private.actor_role() = 'agency_owner' and private.actor_agency() = p_agency_id)) then
    raise exception 'not_found';
  end if;
  if p_brand_color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'not_found'; end if;
  update public.agencies
  set name = left(trim(p_name), 80), brand_color = p_brand_color, logo_text = left(p_logo_text, 4), logo_url = p_logo_url
  where id = p_agency_id;
end;
$$;

create or replace function public.mark_notifications_read(p_ids text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.notifications set read = true where user_id = auth.uid()::text and id = any(p_ids);
end;
$$;

create or replace function public.set_agency_plan(p_agency_id text, p_plan text, p_plan_status text, p_trial_ends_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.is_super_admin() then raise exception 'not_found'; end if;
  if p_plan not in ('starter', 'pro') or p_plan_status not in ('active', 'trialing', 'canceled') then raise exception 'not_found'; end if;
  update public.agencies set plan = p_plan, plan_status = p_plan_status, trial_ends_at = p_trial_ends_at where id = p_agency_id;
end;
$$;

create or replace function public.register_file(
  p_id text, p_project_id text, p_name text, p_filename text, p_version text, p_bytes integer, p_mime text, p_storage_path text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_agency text;
begin
  if not private.can_edit_project(p_project_id) then raise exception 'not_found'; end if;
  select agency_id into v_agency from public.projects where id = p_project_id;
  insert into public.files (id, project_id, agency_id, name, filename, version, bytes, mime, uploaded_by, storage_path)
  values (p_id, p_project_id, v_agency, left(trim(p_name), 80), left(p_filename, 120), left(trim(p_version), 20), p_bytes, p_mime, auth.uid()::text, p_storage_path);
end;
$$;

revoke all on function public.decide_deliverable(text, text, text) from public;
revoke all on function public.add_comment(text, text) from public;
revoke all on function public.resubmit_deliverable(text, text) from public;
revoke all on function public.set_task_status(text, text) from public;
revoke all on function public.create_project(text, text, text, date) from public;
revoke all on function public.update_brand(text, text, text, text, text) from public;
revoke all on function public.mark_notifications_read(text[]) from public;
revoke all on function public.set_agency_plan(text, text, text, timestamptz) from public;
revoke all on function public.register_file(text, text, text, text, text, integer, text, text) from public;

grant execute on function public.decide_deliverable(text, text, text) to authenticated;
grant execute on function public.add_comment(text, text) to authenticated;
grant execute on function public.resubmit_deliverable(text, text) to authenticated;
grant execute on function public.set_task_status(text, text) to authenticated;
grant execute on function public.create_project(text, text, text, date) to authenticated;
grant execute on function public.update_brand(text, text, text, text, text) to authenticated;
grant execute on function public.mark_notifications_read(text[]) to authenticated;
grant execute on function public.set_agency_plan(text, text, text, timestamptz) to authenticated;
grant execute on function public.register_file(text, text, text, text, text, integer, text, text) to authenticated;

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

create policy project_files_read on storage.objects for select to authenticated
using (bucket_id = 'project-files' and private.can_access_project((storage.foldername(name))[2]));

create policy project_files_insert on storage.objects for insert to authenticated
with check (bucket_id = 'project-files' and private.can_edit_project((storage.foldername(name))[2]));

create policy project_files_update on storage.objects for update to authenticated
using (bucket_id = 'project-files' and private.can_edit_project((storage.foldername(name))[2]))
with check (bucket_id = 'project-files' and private.can_edit_project((storage.foldername(name))[2]));
