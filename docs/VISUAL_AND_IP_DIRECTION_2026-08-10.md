# CURIÓ — direção visual e organização de ativos

Data: 10/08/2026

## Decisões desta rodada

- O produto não depende de IA. A criação pedagógica principal é manual e revisada por pessoas.
- O Gerador deixa de aparecer na navegação do Admin e a central do Professor mantém apenas os editores de Missão, Caderno/Atividade, Material e Avaliação.
- A marca/logo atual não deve ser tratada como final. O componente de marca foi convertido em um slot substituível.
- O Portal do Aluno deve ser mais vivo e convidativo, sem perder conforto visual.
- Emojis devem ser substituídos por ícones vetoriais e ilustrações próprias.
- Personagens nunca devem ser esticados para preencher caixas. Usar `object-fit: contain`, preservar proporção e manter o arquivo-fonte original.
- A lateral recolhida deve ter o mesmo comportamento visual em Admin, Professor, Família e Aluno.
- O seletor `Acompanhando` da Família deve desaparecer completamente no modo compacto, sem ficar cortado.
- O convite de interesse do Modo Pensar aparece no máximo uma vez por mês, a partir do dia 3.

## Direção das novas ilustrações

As novas referências de personagens fornecidas em 10/08/2026 devem ser tratadas como família de ativos, preferencialmente com três usos por personagem:

1. **principal** — pose/corpo para hero, capa, material e cenas;
2. **avatar** — enquadramento adequado para perfil e lateral;
3. **apoio** — variação para dicas, conquistas, cards e documentos.

Padrão sugerido:

```text
curio_[personagem]_principal_v01.png
curio_[personagem]_avatar_v01.png
curio_[personagem]_apoio_v01.png
```

## Portal do Aluno

Direção visual:

- hero azul/roxo, grande e arredondado;
- personagem em palco claro com `object-fit: contain`;
- cards creme/azul-claro/rosa/lima para indicadores;
- ícones SVG em lugar de emoji;
- cards com bordas de 22–28px;
- tipografia Fredoka para títulos e Nunito Sans para texto;
- animação mínima e respeitando `data-motion="reduced"`;
- progressos somente com dados reais.

## Documentos e PDFs

Três famílias visuais devem compartilhar a mesma identidade:

- **Jurídico/institucional:** muito legível, cor discreta, identidade apenas em cabeçalho/capa/rodapé.
- **Pedagógico:** cards arredondados, personagens de apoio, boxes e bastante espaço para resposta.
- **Certificados:** paisagem, nome em destaque, carga horária/data/código, espaço de marca substituível e personagem lateral.

## Cofre Curió

Criado no Google Drive em 10/08/2026 como trilha documental do projeto, com pastas para:

- Marca e Identidade;
- Software e Produto;
- Conceito, Visão e Metodologia;
- Modo Pensar / Trilhas / Certificados;
- Conteúdos, PDFs e Modelos;
- Personagens, Avatares e Ilustrações;
- Histórico, Versões e Evidências;
- Jurídico, Contratos e Políticas;
- Pesquisa de Marca e Nome;
- Caixa de Entrada.

A existência do Cofre não substitui registro de marca, direito autoral, contratos ou outros registros jurídicos formais.
