# CURIÓ — Plano da IA Especialista para Professor e Administração

## Objetivo
Criar uma IA interna do CURIÓ para reduzir trabalho operacional e apoiar decisões pedagógicas sem substituir a professora nem publicar ações automaticamente.

## Quem pode usar
- Professor: somente sobre alunos vinculados a ele.
- Admin: visão operacional global e, quando necessário, visão pedagógica autorizada.
- Família e Aluno: não terão acesso a esta IA especialista interna.

## O que a IA do Professor poderá fazer
- resumir o momento atual do aluno com base no Mapa Pedagógico;
- apontar habilidades consolidadas, em desenvolvimento e com pouca evidência;
- sugerir próxima Missão Cuca;
- sugerir atividade de Caderno Curió;
- sugerir intervenção, revisão ou grupo pedagógico;
- ajudar a preparar correções e feedbacks;
- transformar PDF/TXT/DOCX em rascunhos conforme os modelos oficiais do CURIÓ;
- detectar repetição excessiva de atividade e sugerir variações;
- ajudar a elaborar relatório para família a partir de dados estruturados.

## O que a IA do Admin poderá fazer
- explicar indicadores operacionais;
- apoiar organização de matrículas, turmas, calendário e conteúdo;
- localizar pendências de cadastros e acessos;
- ajudar a revisar catálogo de cursos, modelos e materiais;
- preparar rascunhos de comunicação;
- apontar inconsistências sem alterar dados automaticamente.

## Contexto pedagógico permitido
A migration `ai_specialist_scaffold` criou `build_ai_student_context(student_id)`. Ela entrega somente:
- nome preferido e série;
- conteúdos atuais;
- estados de habilidades;
- domínio, autonomia, confiança, tendência, prioridade e quantidade de evidências;
- evidências pedagógicas recentes em forma estruturada;
- missões recentes e evolução antes/depois;
- intervenções recentes.

Ela não deve enviar para o modelo, por padrão:
- mensagens privadas da família;
- dados financeiros;
- contratos;
- PIN;
- senha;
- chaves de API;
- dados pessoais que não sejam necessários para a tarefa.

## Regra de segurança
A IA sugere. Professor/Admin decide. Toda ação importante deve exigir confirmação humana antes de criar, publicar, atribuir, apagar ou alterar algo.

## Situação atual
A estrutura de dados, RLS e função segura de contexto já estão preparadas. Ainda falta escolher e configurar um provedor/modelo de IA e implementar o worker que lê `generation_jobs`/conversas e devolve os rascunhos.
