-- CURIÓ · Corrige placeholders jurídicos antigos marcados como publicados sem conteúdo.
-- Um documento sem body e sem file_path não é publicação válida e deve voltar a rascunho
-- para poder ser editado pelo Admin antes de aparecer no site público.

update public.legal_documents
set status = 'draft',
    published_at = null,
    updated_at = now()
where status = 'published'
  and is_current = true
  and nullif(btrim(coalesce(body, '')), '') is null
  and nullif(btrim(coalesce(file_path, '')), '') is null;
