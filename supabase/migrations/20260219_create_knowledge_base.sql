-- Enable pgvector extension for embeddings
create extension if not exists vector;

-- Create documents table for Knowledge Base
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  content text not null,
  embedding vector(768), -- Gemini 1.5 embedding dimension
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Internal index for faster vector search
create index on public.documents using hnsw (embedding vector_cosine_ops);

-- RLS Policies
alter table public.documents enable row level security;

create policy "Users can view their clinic's documents"
  on public.documents for select
  using (
    auth.uid() in (
      select user_id from public.staff_memberships
      where clinic_id = documents.clinic_id
    )
  );

create policy "Users can insert documents for their clinic"
  on public.documents for insert
  with check (
    auth.uid() in (
      select user_id from public.staff_memberships
      where clinic_id = documents.clinic_id
    )
  );

-- Function to match documents
create or replace function match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_clinic_id uuid
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  and documents.clinic_id = filter_clinic_id
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
