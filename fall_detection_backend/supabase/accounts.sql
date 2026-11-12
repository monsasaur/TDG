-- ============================================================
-- บัญชีผู้ใช้ + สิทธิ์รายบ้าน (รอบแรก) — 2026-11-12
--
-- ⚠️ รันหลังจากแอปเวอร์ชันที่มีหน้า login ใช้งานได้แล้วเท่านั้น
--    พอเปิด RLS แล้ว คนที่ไม่ได้ login จะไม่เห็นข้อมูลอะไรเลย และบ้านเดิมจะยังไม่มีเจ้าของ
--    (ยกบ้านเดิมให้บัญชีแรกได้ด้วยคำสั่งท้ายไฟล์)
-- ⚠️ Express API ต้องใช้ service_role key (ข้าม RLS) — ถ้าใช้ anon key จะเขียน fall_events / alerts ไม่ได้
--
-- ลำดับ: schema.sql → accounts.sql → สมัครบัญชีแรกในแอป → คำสั่งท้ายไฟล์ (ครั้งเดียว)
-- รันซ้ำได้ (create or replace · if not exists · drop policy if exists)
--
-- บทบาทตาม docs/reports/role_permission_matrix_0.2.md
--   owner      สร้าง/แก้/ลบบ้าน · เพิ่ม/แก้อุปกรณ์ · แก้เบอร์ฉุกเฉิน · เชิญ/ถอดสมาชิก
--   caregiver  เห็นบ้านที่ถูกเชิญ · ดูอุปกรณ์ · ดูและกดรับทราบการแจ้งเตือน
-- ============================================================

-- ── สมาชิกบ้าน ────────────────────────────────────────────────
create table if not exists house_members (
  house_id   text not null references houses(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'caregiver' check (role in ('owner', 'caregiver')),
  joined_at  timestamptz not null default now(),
  primary key (house_id, user_id)
);
create index if not exists idx_house_members_user on house_members(user_id);

-- ── รหัสเชิญเข้าบ้าน (ใช้ได้ครั้งเดียว · หมดอายุ) ────────────────
create table if not exists house_invites (
  code        text primary key,
  house_id    text not null references houses(id) on delete cascade,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_by     uuid references auth.users(id) on delete set null,
  used_at     timestamptz
);

-- ── ผู้ติดต่อฉุกเฉิน: จำว่าใครสร้าง ─────────────────────────────
-- ต้องมี เพราะแอปสร้างผู้ติดต่อก่อนแล้วค่อยผูกกับบ้าน — ช่วงนั้นยังไม่ได้ผูก
-- ถ้าไม่มีคอลัมน์นี้ คนสร้างจะมองไม่เห็นแถวที่ตัวเองเพิ่งสร้าง
alter table emergency_contacts
  add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null;

-- ── push token: จำว่าเครื่องนี้ login เป็นใคร ─────────────────────
-- Express ส่ง push ของบ้านให้เฉพาะเครื่องของสมาชิกบ้านนั้น (pushService.recipientsFor)
-- null = เครื่องที่ยังไม่ได้ login / ออกจากระบบแล้ว → ไม่ได้รับ push ของบ้านไหนเลยหลังเปิดระบบบัญชี
-- ลบบัญชีแล้วเครื่องยังลงทะเบียนอยู่ (set null) ไม่ใช่ลบแถวทิ้ง
alter table push_tokens
  add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists idx_push_tokens_user on push_tokens(user_id);

-- ── ฟังก์ชันเช็คสิทธิ์ ─────────────────────────────────────────
-- security definer: อ่าน house_members ได้โดยไม่ติด policy ของ house_members เอง (กันวนอ้างตัวเอง)
create or replace function public.is_house_member(h text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from house_members where house_id = h and user_id = auth.uid())
$$;

create or replace function public.is_house_owner(h text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from house_members where house_id = h and user_id = auth.uid() and role = 'owner'
  )
$$;

-- ── สร้างบ้าน: ผ่านฟังก์ชันนี้เท่านั้น ─────────────────────────────
-- สร้างบ้าน + ตั้งคนสร้างเป็น owner ในคำสั่งเดียว
-- (insert ตรงแล้วใช้ trigger ไม่ได้ — ตอน insert ... returning ยังไม่มีแถวสมาชิก
--  policy ฝั่ง select จะไม่ให้เห็นบ้านที่เพิ่งสร้าง แล้ว insert ทั้งคำสั่งล้ม)
create or replace function public.create_house(p_name text) returns houses
language plpgsql security definer set search_path = public as $$
declare
  h houses;
  -- ตรงกับ MAX_HOUSES ใน data/useHouses.ts · นับทุกบ้านที่เป็นสมาชิก ไม่ใช่แค่ที่เป็นเจ้าของ
  -- (แอปเช็คก่อนด้วยจำนวนบ้านที่เห็น และข้อความในแอปบอกว่า "เป็นสมาชิกของบ้านต่างๆ ครบจำนวนสูงสุด")
  max_houses constant int := 5;
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'ต้องมีชื่อบ้าน' using errcode = '22023';
  end if;
  if (select count(*) from house_members where user_id = auth.uid()) >= max_houses then
    raise exception 'เป็นสมาชิกได้สูงสุด % บ้าน ออกจากบ้านอื่นก่อน', max_houses using errcode = 'P0001';
  end if;

  insert into houses (id, name)
  values ('h' || replace(gen_random_uuid()::text, '-', ''), trim(p_name))
  returning * into h;

  insert into house_members (house_id, user_id, role) values (h.id, auth.uid(), 'owner');
  return h;
end $$;

-- ── เชิญเข้าบ้าน: owner สร้างรหัส 6 ตัว อายุ 15 นาที ───────────────
create or replace function public.create_house_invite(p_house_id text) returns house_invites
language plpgsql security definer set search_path = public as $$
declare
  inv      house_invites;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- 32 ตัว ตัด I O 0 1 ที่อ่านสับสน
  b        bytea;
  c        text;
begin
  if not is_house_owner(p_house_id) then
    raise exception 'เฉพาะเจ้าของบ้านที่เชิญสมาชิกได้' using errcode = '42501';
  end if;

  loop
    -- สุ่มจาก gen_random_uuid() (สุ่มแบบปลอดภัย) · ไบต์ 0–5 ไม่มีบิต version/variant
    -- 256 หาร 32 ลงตัว แต่ละตัวอักษรจึงมีโอกาสเท่ากัน
    b := uuid_send(gen_random_uuid());
    c := '';
    for i in 0..5 loop
      c := c || substr(alphabet, 1 + (get_byte(b, i) % 32), 1);
    end loop;
    begin
      insert into house_invites (code, house_id, created_by, expires_at)
      values (c, p_house_id, auth.uid(), now() + interval '15 minutes')
      returning * into inv;
      return inv;
    exception when unique_violation then
      -- ชนกับรหัสที่มีอยู่ สุ่มใหม่
    end;
  end loop;
end $$;

-- ── เข้าบ้านด้วยรหัสเชิญ ──────────────────────────────────────
create or replace function public.join_house(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  inv         house_invites;
  max_houses  constant int := 5;   -- ตรงกับ MAX_HOUSES ใน data/useHouses.ts
  max_members constant int := 6;   -- ตรงกับ MAX_MEMBERS_PER_HOUSE ใน data/useContacts.ts (นับเจ้าของด้วย)
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน' using errcode = '42501';
  end if;

  select * into inv from house_invites where code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'รหัสไม่ถูกต้อง' using errcode = 'P0002';
  end if;
  if inv.used_at is not null then
    raise exception 'รหัสนี้ถูกใช้ไปแล้ว ขอรหัสใหม่จากเจ้าของบ้าน' using errcode = 'P0001';
  end if;
  if inv.expires_at < now() then
    raise exception 'รหัสหมดอายุแล้ว ขอรหัสใหม่จากเจ้าของบ้าน' using errcode = 'P0001';
  end if;

  -- เป็นสมาชิกอยู่แล้ว (เช่นเจ้าของบ้านสแกนรหัสของตัวเอง) — ไม่ต้องทำอะไร และไม่เผารหัสทิ้ง
  if exists (select 1 from house_members where house_id = inv.house_id and user_id = auth.uid()) then
    return inv.house_id;
  end if;
  if (select count(*) from house_members where user_id = auth.uid()) >= max_houses then
    raise exception 'เป็นสมาชิกได้สูงสุด % บ้าน ออกจากบ้านอื่นก่อน', max_houses using errcode = 'P0001';
  end if;
  -- ล็อกแถวบ้านก่อนนับ — สองคนกดเข้าพร้อมกันด้วยคนละรหัสจะได้ไม่เกินจำนวนทั้งคู่
  perform 1 from houses where id = inv.house_id for update;
  if (select count(*) from house_members where house_id = inv.house_id) >= max_members then
    raise exception 'บ้านนี้มีสมาชิกครบ % คนแล้ว', max_members using errcode = 'P0001';
  end if;

  insert into house_members (house_id, user_id, role) values (inv.house_id, auth.uid(), 'caregiver');

  update house_invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.house_id;
end $$;

-- ── รายชื่อสมาชิกของทุกบ้านที่คนเรียกเป็นสมาชิกอยู่ ──────────────
-- แอปอ่าน auth.users ตรงไม่ได้ (ชื่อที่แสดงกับเบอร์อยู่ในนั้น) — ฟังก์ชันนี้คืนให้เฉพาะคนในบ้านเดียวกัน
-- ใช้กับหน้าสมาชิก (app/members.tsx · member-detail.tsx)
create or replace function public.house_member_list()
returns table (house_id text, house_name text, user_id uuid, role text, display_name text, phone text)
language sql stable security definer set search_path = public as $$
  select m.house_id, h.name, m.user_id, m.role,
         coalesce(nullif(trim(u.raw_user_meta_data->>'name'), ''), '') as display_name,
         u.phone
  from house_members m
  join houses h     on h.id = m.house_id
  join auth.users u on u.id = m.user_id
  where m.house_id in (select hm.house_id from house_members hm where hm.user_id = auth.uid())
  order by h.created_at, m.joined_at
$$;

-- ฟังก์ชันเรียกได้เฉพาะคนที่ login (Postgres ให้ทุกคนเรียกได้เป็นค่าเริ่มต้น)
revoke execute on function public.is_house_member(text)     from public, anon;
revoke execute on function public.is_house_owner(text)      from public, anon;
revoke execute on function public.create_house(text)        from public, anon;
revoke execute on function public.create_house_invite(text) from public, anon;
revoke execute on function public.join_house(text)          from public, anon;
revoke execute on function public.house_member_list()       from public, anon;
grant  execute on function public.is_house_member(text)     to authenticated;
grant  execute on function public.is_house_owner(text)      to authenticated;
grant  execute on function public.create_house(text)        to authenticated;
grant  execute on function public.create_house_invite(text) to authenticated;
grant  execute on function public.join_house(text)          to authenticated;
grant  execute on function public.house_member_list()       to authenticated;

-- ── เปิด RLS ─────────────────────────────────────────────────
alter table houses             enable row level security;
alter table devices            enable row level security;
alter table alerts             enable row level security;
alter table emergency_contacts enable row level security;
alter table house_contacts     enable row level security;
alter table house_members      enable row level security;
alter table house_invites      enable row level security;
-- ตารางฝั่ง backend: เปิด RLS โดยไม่มี policy = เข้าได้เฉพาะ service_role (Express)
alter table fall_events        enable row level security;
alter table push_tokens        enable row level security;
alter table ml_models          enable row level security;

-- houses — ไม่มี insert policy: สร้างผ่าน create_house() เท่านั้น
drop policy if exists houses_select on houses;
drop policy if exists houses_update on houses;
drop policy if exists houses_delete on houses;
create policy houses_select on houses for select to authenticated using (is_house_member(id));
create policy houses_update on houses for update to authenticated
  using (is_house_owner(id)) with check (is_house_owner(id));
create policy houses_delete on houses for delete to authenticated using (is_house_owner(id));

-- devices
drop policy if exists devices_select on devices;
drop policy if exists devices_insert on devices;
drop policy if exists devices_update on devices;
drop policy if exists devices_delete on devices;
create policy devices_select on devices for select to authenticated using (is_house_member(house_id));
create policy devices_insert on devices for insert to authenticated with check (is_house_owner(house_id));
create policy devices_update on devices for update to authenticated
  using (is_house_owner(house_id)) with check (is_house_owner(house_id));
create policy devices_delete on devices for delete to authenticated using (is_house_owner(house_id));

-- alerts — สร้างโดย Express (service_role) · สมาชิกทุกคนกดรับทราบได้
drop policy if exists alerts_select on alerts;
drop policy if exists alerts_update on alerts;
create policy alerts_select on alerts for select to authenticated using (is_house_member(house_id));
create policy alerts_update on alerts for update to authenticated
  using (is_house_member(house_id)) with check (is_house_member(house_id));

-- emergency_contacts — เห็นของบ้านที่เป็นสมาชิก · แก้ได้เฉพาะ owner ของบ้านที่ผูกอยู่ หรือคนสร้าง
drop policy if exists contacts_select on emergency_contacts;
drop policy if exists contacts_insert on emergency_contacts;
drop policy if exists contacts_update on emergency_contacts;
drop policy if exists contacts_delete on emergency_contacts;
create policy contacts_select on emergency_contacts for select to authenticated using (
  created_by = auth.uid()
  or exists (select 1 from house_contacts hc
             where hc.contact_id = emergency_contacts.id and is_house_member(hc.house_id))
);
create policy contacts_insert on emergency_contacts for insert to authenticated
  with check (created_by = auth.uid());
create policy contacts_update on emergency_contacts for update to authenticated using (
  created_by = auth.uid()
  or exists (select 1 from house_contacts hc
             where hc.contact_id = emergency_contacts.id and is_house_owner(hc.house_id))
);
create policy contacts_delete on emergency_contacts for delete to authenticated using (
  created_by = auth.uid()
  or exists (select 1 from house_contacts hc
             where hc.contact_id = emergency_contacts.id and is_house_owner(hc.house_id))
);

-- house_contacts — ผูก/ถอดผู้ติดต่อกับบ้าน: owner เท่านั้น
drop policy if exists house_contacts_select on house_contacts;
drop policy if exists house_contacts_insert on house_contacts;
drop policy if exists house_contacts_delete on house_contacts;
create policy house_contacts_select on house_contacts for select to authenticated
  using (is_house_member(house_id));
create policy house_contacts_insert on house_contacts for insert to authenticated
  with check (is_house_owner(house_id));
create policy house_contacts_delete on house_contacts for delete to authenticated
  using (is_house_owner(house_id));

-- house_members — เห็นสมาชิกบ้านเดียวกัน · owner ถอด caregiver ได้ · caregiver ออกเองได้
-- (เพิ่มสมาชิกผ่าน create_house / join_house เท่านั้น · owner ออกเองไม่ได้ กันบ้านไม่มีเจ้าของ)
drop policy if exists members_select on house_members;
drop policy if exists members_delete on house_members;
create policy members_select on house_members for select to authenticated
  using (is_house_member(house_id));
create policy members_delete on house_members for delete to authenticated using (
  role <> 'owner' and (user_id = auth.uid() or is_house_owner(house_id))
);

-- house_invites — owner ดูรหัสที่ตัวเองสร้างได้ (สร้างผ่าน create_house_invite เท่านั้น)
drop policy if exists invites_select on house_invites;
create policy invites_select on house_invites for select to authenticated
  using (is_house_owner(house_id));

-- ============================================================
-- (ครั้งเดียว) ยกบ้านที่มีอยู่ก่อนเปิดระบบบัญชีให้บัญชีแรกเป็นเจ้าของ
-- สมัครบัญชีในแอปก่อน แล้วเปลี่ยนเบอร์ด้านล่างเป็นเบอร์ของบัญชีนั้น แล้วรันเฉพาะคำสั่งนี้
-- เขียนแบบ 66 ตามด้วยเบอร์ที่ตัด 0 ตัวหน้าออก (081-234-5678 → 66812345678)
-- Supabase เก็บ auth.users.phone แบบไม่มี + อยู่แล้ว — ltrim กันไว้เผื่อ
-- คำสั่งนี้ข้ามเพดาน 5 บ้าน — ถ้ามีบ้านเดิมเกิน 5 หลัง บัญชีนี้จะสร้าง/เข้าบ้านเพิ่มไม่ได้จนกว่าจะลบบ้านออก
-- ============================================================
-- insert into house_members (house_id, user_id, role)
-- select h.id, u.id, 'owner'
-- from houses h cross join auth.users u
-- where ltrim(u.phone, '+') = '66812345678'
-- on conflict (house_id, user_id) do nothing;
