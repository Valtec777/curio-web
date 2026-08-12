-- CURIÓ · amplia as fontes aceitas pelo Gerador sem tornar o bucket público.
-- PDF/DOCX continuam aceitos; CSV/XLSX passam a ser fontes opcionais para transformação.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
]
where id = 'generation-sources';
