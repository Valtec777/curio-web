-- Publish the current public privacy notices without exposing incomplete provider placeholders.

update public.legal_documents
set
  title = 'Política de Privacidade — PLUMARELI',
  document_type = 'Política de Privacidade',
  audience = 'public',
  body = $privacy$
POLÍTICA DE PRIVACIDADE DO {{BRAND_NAME}}

1. OBJETIVO E CONTROLADOR
Esta Política explica como o {{BRAND_NAME}}, operado por {{PROVIDER_LEGAL_NAME}}, trata dados pessoais no site público e nas áreas autenticadas. Para dúvidas sobre privacidade e exercício de direitos, use {{PRIVACY_CONTACT}}. Para atendimento geral, use {{PROVIDER_EMAIL}}.

2. PRINCÍPIOS E PROTEÇÃO DE CRIANÇAS E ADOLESCENTES
O tratamento de dados de crianças e adolescentes é orientado pelo melhor interesse, necessidade, adequação, segurança, transparência e minimização. O {{BRAND_NAME}} não possui cadastro público de crianças: o acesso do aluno é liberado dentro de um vínculo educacional e administrativo, com participação do responsável quando aplicável. O serviço não vende dados pessoais e não utiliza dados de crianças e adolescentes para publicidade comportamental.

3. DADOS QUE PODEM SER TRATADOS
Conforme a etapa do relacionamento, podem ser tratados:
- dados do responsável, como nome, e-mail, telefone e dados necessários à contratação e atendimento;
- dados do aluno, como nome ou nome preferido, faixa etária/idade, ano escolar, escola e vínculos com responsáveis e professores;
- dados educacionais, como conteúdos em estudo, atividades, respostas, avaliações, agenda, progresso, devolutivas e evidências pedagógicas;
- arquivos enviados pela família, aluno ou equipe, como imagens de atividades, PDFs e materiais escolares;
- dados contratuais e financeiros necessários à cobrança, confirmação de pagamento e emissão de registros;
- comunicações, solicitações de suporte, registros de consentimento/autorização e eventos de segurança;
- dados técnicos necessários ao funcionamento e à proteção da conta, como registros de autenticação e operação.

4. DADOS COLETADOS NO PRIMEIRO CONTATO
No formulário público, o {{BRAND_NAME}} busca limitar a coleta ao necessário para entender a solicitação e retornar o contato. Informações adicionais sobre a criança devem ser fornecidas apenas quando forem úteis ao atendimento. Dados mais detalhados do aluno são coletados posteriormente, quando necessários à matrícula e ao acompanhamento.

5. FINALIDADES
Os dados podem ser utilizados para:
- responder pedidos de contato e organizar matrícula;
- autenticar usuários e controlar o acesso por perfil e vínculo;
- prestar e personalizar o acompanhamento escolar;
- organizar encontros, atividades, materiais, avaliações e devolutivas;
- apresentar à família informações compatíveis com sua autorização de acesso;
- viabilizar comunicação entre equipe, responsável e aluno quando aplicável;
- processar e conferir pagamentos e cumprir obrigações contratuais, fiscais e legais;
- prevenir abuso, fraude, acesso indevido e incidentes de segurança;
- atender solicitações de titulares e exercer direitos em processos administrativos ou judiciais;
- melhorar a operação de forma compatível com a finalidade educacional e com o melhor interesse do aluno.

6. BASES LEGAIS
Cada operação utiliza a hipótese legal adequada prevista na legislação aplicável, incluindo, conforme o caso, execução de contrato ou procedimentos preliminares solicitados pelo titular, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, legítimo interesse quando cabível e compatível com os direitos do titular, consentimento quando essa for a base apropriada e outras hipóteses previstas em lei. Para crianças e adolescentes, qualquer base legal deve ser aplicada com avaliação e prevalência do melhor interesse.

7. CONSENTIMENTOS E AUTORIZAÇÕES OPCIONAIS
Autorizações específicas, como uso institucional de imagem, voz ou produções do aluno, são separadas do acesso ao serviço educacional quando não forem necessárias à prestação principal. A recusa ou revogação de uma autorização opcional não deve impedir o uso do serviço principal, salvo quando o tratamento for indispensável à funcionalidade solicitada.

8. COMPARTILHAMENTO E OPERADORES
O {{BRAND_NAME}} pode utilizar fornecedores necessários de hospedagem, banco de dados, autenticação, armazenamento, comunicação, videoconferência, segurança e recursos tecnológicos. O acesso deve ser limitado ao necessário para a finalidade contratada e sujeito a controles técnicos e contratuais compatíveis com o risco. Dados não são comercializados com anunciantes.

9. TRANSFERÊNCIAS INTERNACIONAIS
Alguns fornecedores tecnológicos podem envolver processamento ou suporte fora do Brasil. Quando houver transferência internacional de dados pessoais, o {{BRAND_NAME}} deve observar as salvaguardas e mecanismos previstos na legislação e manter informação de transparência compatível com a operação efetivamente utilizada.

10. TECNOLOGIA, IA E DECISÕES PEDAGÓGICAS
Recursos automatizados podem apoiar organização, geração de rascunhos ou análise operacional. A IA não deve publicar atividade automaticamente em nome do professor nem substituir a revisão humana em decisões pedagógicas que exijam julgamento profissional. Evidências brutas não devem ser expostas à família ou à criança quando um estado agregado for suficiente para a finalidade de acompanhamento.

11. RETENÇÃO E ELIMINAÇÃO
Os dados são mantidos pelo tempo necessário à finalidade que justificou a coleta e, quando aplicável, por prazos adicionais necessários ao cumprimento de obrigações legais, contratuais, financeiras, segurança ou exercício de direitos. Encerrada a finalidade e inexistindo base para retenção, os dados devem ser eliminados, anonimizados ou mantidos de forma legalmente permitida.

12. SEGURANÇA
São utilizados controles de acesso por função e vínculo, autenticação, políticas de segurança no banco de dados, armazenamento privado para arquivos sensíveis e registros operacionais. O princípio do menor privilégio orienta o acesso aos dados. Nenhum sistema elimina todos os riscos, e medidas são revisadas conforme a evolução do serviço e das ameaças.

13. DIREITOS DOS TITULARES
O titular ou seu responsável, quando aplicável, pode solicitar confirmação de tratamento, acesso, correção, informações sobre compartilhamento, anonimização, bloqueio ou eliminação quando cabível, portabilidade nos termos da regulamentação, oposição, revisão de decisões quando aplicável, revogação de consentimento e demais direitos previstos em lei. Solicitações podem ser feitas por {{PRIVACY_CONTACT}} e poderão exigir confirmação de identidade proporcional ao risco.

14. INCIDENTES E SEGURANÇA DA CONTA
Suspeitas de acesso indevido ou incidentes envolvendo dados pessoais devem ser comunicadas ao canal {{PRIVACY_CONTACT}}. O {{BRAND_NAME}} avaliará o evento e adotará as providências técnicas, administrativas e regulatórias aplicáveis.

15. ALTERAÇÕES
Mudanças materiais nesta Política serão publicadas em nova versão. Quando a alteração exigir nova ciência, consentimento ou autorização, o registro correspondente será solicitado de forma específica.

16. CONTATO
Privacidade: {{PRIVACY_CONTACT}}.
Atendimento: {{PROVIDER_EMAIL}}.
$privacy$,
  status = 'published',
  is_current = true,
  published_at = coalesce(published_at, now()),
  updated_at = now()
where public_slug = 'politica-de-privacidade'
  and version = 1;

update public.legal_documents
set
  title = 'PRIVACIDADE DA CRIANÇA — PLUMARELI',
  document_type = 'Privacidade da Criança',
  audience = 'public',
  body = $child_privacy$
PRIVACIDADE DA CRIANÇA E DO ADOLESCENTE — {{BRAND_NAME}}

Este aviso explica, em linguagem simples, como o {{BRAND_NAME}} cuida das informações de crianças e adolescentes. Ele complementa a Política de Privacidade.

1. SEUS DADOS TÊM UMA FINALIDADE
O {{BRAND_NAME}} usa informações que ajudam a organizar seu acompanhamento, suas atividades, encontros e a segurança do seu espaço. Você não precisa fornecer informação que não tenha relação com o serviço.

2. O ACESSO É CONTROLADO
Não existe cadastro público de criança no {{BRAND_NAME}}. O espaço do aluno é liberado dentro de um vínculo educacional e administrativo. Responsáveis, professores e administração possuem acessos diferentes, conforme sua função e vínculo com o aluno.

3. SEUS ESTUDOS SÃO SEUS
Respostas, textos, desenhos, fotos de atividades e outros materiais podem ser usados para o professor acompanhar a aprendizagem e dar devolutivas. Esses dados não são vendidos e não devem ser usados para publicidade comportamental.

4. QUEM PODE VER
Professores acessam informações dos alunos vinculados ao seu acompanhamento. Responsáveis acessam informações das crianças às quais estão vinculados, conforme as permissões aplicáveis. A administração acessa o necessário para operar, proteger e prestar o serviço. Fornecedores tecnológicos só devem receber o necessário para executar suas funções.

5. IMAGEM, VOZ E PRODUÇÕES
Se o {{BRAND_NAME}} quiser usar sua imagem, voz ou produção para divulgação que não seja necessária ao acompanhamento, isso depende de autorização separada quando exigida. Dizer “não” a uma autorização opcional não impede a continuidade do serviço educacional principal.

6. TECNOLOGIA E INTELIGÊNCIA ARTIFICIAL
Ferramentas tecnológicas podem ajudar a organizar informações ou criar rascunhos. A tecnologia não deve decidir sozinha aquilo que precisa de avaliação pedagógica humana. Um professor ou profissional responsável continua participando das decisões importantes sobre aprendizagem.

7. MENOS DADOS É MELHOR
O {{BRAND_NAME}} procura coletar apenas o que é necessário. Dados mais detalhados sobre dificuldades, rotina ou aprendizagem devem ser usados apenas quando ajudarem no acompanhamento e forem adequados ao melhor interesse do aluno.

8. VOCÊ E SUA FAMÍLIA PODEM PERGUNTAR
Você pode conversar com seu responsável sobre os seus dados. O responsável pode pedir acesso, correção, explicações ou outras providências previstas em lei pelo canal {{PRIVACY_CONTACT}}.

9. SEGURANÇA
O {{BRAND_NAME}} usa controles de acesso, autenticação e armazenamento privado para reduzir riscos. Se algo estranho acontecer na conta, avise um adulto responsável e a equipe.

10. RESPEITO E MELHOR INTERESSE
Nenhum recurso deve usar seus dados de forma discriminatória, humilhante, manipuladora ou incompatível com seu desenvolvimento, sua segurança e seu melhor interesse.

Privacidade: {{PRIVACY_CONTACT}}.
$child_privacy$,
  status = 'published',
  is_current = true,
  published_at = coalesce(published_at, now()),
  updated_at = now()
where public_slug = 'privacidade-da-crianca'
  and version = 1;
