-- CURIÓ · fontes privadas do editor de conteúdo

update storage.buckets
set file_size_limit=15728640,
    allowed_mime_types=array[
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'image/png',
      'image/jpeg',
      'image/webp'
    ]::text[]
where id='generation-sources';

update storage.buckets
set allowed_mime_types=array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/webp'
    ]::text[]
where id='teacher-materials';
