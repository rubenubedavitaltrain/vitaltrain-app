-- Documentos del paciente (núcleo): PDFs que el coach comparte por pilar (plan de alimentación, protocolos...).
-- Los archivos van en un almacén privado de Supabase Storage (bucket "documentos"), en la carpeta del paciente.
-- Solo el coach sube y borra. El paciente solo puede abrir los suyos marcados como compartidos.
-- Depende de 0001-0015.

create table patient_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id) on delete cascade,
  pillar_id uuid references pillars(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  note text check (char_length(note) <= 300),
  storage_path text not null unique check (storage_path like patient_id::text || '/%'),
  size_bytes int check (size_bytes between 1 and 20971520),
  mime text not null default 'application/pdf' check (mime = 'application/pdf'),
  is_shared boolean not null default true,
  uploaded_by uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index patient_documents_patient_idx on patient_documents (patient_id, created_at desc);

alter table patient_documents enable row level security;
create policy coach_all on patient_documents for all using (is_coach()) with check (is_coach());
create policy patient_read on patient_documents for select
  using (patient_id = auth.uid() and is_shared and is_active_patient());

-- Almacén privado: 20 MB por archivo, solo PDF
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 20971520, '{application/pdf}')
on conflict (id) do nothing;

create policy documentos_coach on storage.objects for all to authenticated
  using (bucket_id = 'documentos' and is_coach())
  with check (bucket_id = 'documentos' and is_coach());

create policy documentos_paciente_leer on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and exists (
    select 1 from patient_documents d
    where d.storage_path = storage.objects.name and d.patient_id = auth.uid() and d.is_shared and is_active_patient()));
