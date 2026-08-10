# Rodada Aluno + Acesso — 2026-08-10

## Acesso
- Primeiro acesso e recuperação deixam de gerar `localhost` em Vercel.
- Edge Function `curio-access-admin` v3 ativa, com origem HTTPS segura e fallback para o Preview.
- Configuração de SMTP CURIÓ documentada em `docs/AUTH_EMAIL_SETUP.md` e ainda depende de credencial/configuração externa no Supabase Auth.

## Laterais
- Professor, Família e Aluno com fundo azul garantido por CSS final.
- Ícones sem caixa branca/quadrada; ativo permanece destacado de forma arredondada.
- Aluno mostra avatar persistente, nome, nível/ano e estrelas na lateral.

## Portal do Aluno
- Hoje completo: estrelas, sequência, série, missões, progresso semanal, conquistas, próximo encontro, caderno, avaliação e dica rotativa.
- Missões: busca, matéria, status e períodos Hoje/semana/pendentes/concluídas.
- Agenda: próximos e anteriores + botão para entrar quando houver link.
- Caminho: progresso geral, evolução/desempenho por matéria, gráfico semanal, habilidades dominadas/reforço, conquistas e dica.
- Perfil: avatar persistente e visível no restante do produto.
- Meu Caderno: abrir PDF, enviar foto/PDF, feedback e refazer.
- Conquistas: catálogo de 50 selos com regras automáticas.
- Descobertas: biblioteca pesquisável de missões, cadernos, materiais e avaliações já explorados.
- Modo Pensar: convertido em Cursos Livres, usando as estruturas existentes de curso/módulo/progresso/certificado.
- Modo Prova: próximas avaliações, arquivo e histórico.

## Dados
- `student_experience_core` aplicado no Supabase.
- 50 conquistas ativas, 50 regras de desbloqueio e 32 dicas ativas confirmadas.
- Upload de Caderno usa Storage privado e RPC que valida o estudante.

## Jurídico
- Política de Privacidade geral criada como draft.
- Rascunhos existentes preenchidos para Privacidade da Criança, Termos, Consentimento, Imagem/Voz, Contrato, Pagamentos, Cancelamentos, Recibo e Relatório.
- Nada foi publicado automaticamente.
- Campos de identificação jurídica, regras comerciais e aspectos contábeis continuam explicitamente marcados para revisão.

## Validação
- GitHub Actions: typecheck + build aprovados no head da rodada.
- Vercel Preview: status GitHub/Vercel voltou a `success` após o limite temporário de builds.
- Testes físicos Mac/Windows/iPhone/Android/tablet ainda precisam ser executados; matriz em `docs/CROSS_DEVICE_ACCEPTANCE.md`.
