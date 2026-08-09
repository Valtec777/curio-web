# CURIÓ — Sistema de Marca Digital
Atualizado em 09/08/2026.

## Fonte oficial recomendada

### Fredoka — fonte principal da identidade
Usar em:
- títulos e chamadas;
- botões;
- números grandes e indicadores;
- nomes de missões e conquistas;
- cards de personagens;
- etiquetas curtas e títulos infantis.

Nome para procurar no Canva: **Fredoka**.

### Nunito Sans — fonte de leitura e operação
Usar em:
- parágrafos;
- formulários;
- tabelas;
- Admin;
- relatórios e textos mais longos.

A combinação foi escolhida para manter a marca arredondada e acolhedora sem prejudicar legibilidade em áreas administrativas.

## Paleta-base
- Navy: `#17284E`
- Azul: `#315EFB`
- Rosa: `#FF4AA2`
- Roxo: `#7344F4`
- Lima: `#A8EE25`
- Amarelo: `#FFD454`
- Papel/creme: `#FFFAF0`

## Linguagem visual
- Cards arredondados, com borda inferior mais espessa para sensação de profundidade.
- Botões pressionáveis e feedback claro de estado.
- Muito espaço em branco e hierarquia simples.
- Mascotes como guias, não como decoração excessiva.
- Progresso visual por etapas, estrelas, trilhas e estados.
- O Curió pode se inspirar na clareza e ludicidade de apps de aprendizagem, mantendo cores, personagens, linguagem e símbolos próprios.

## Acessibilidade implementada
A central global de aparência permite:
1. Tema claro, escuro ou seguir o sistema.
2. Apoio visual: fonte ampliada, contraste reforçado e foco visível.
3. Segurança para epilepsia: remove animações/transições e reduz estímulos visuais; não é garantia médica.
4. Foco cognitivo e TDAH: reduz decoração e prioriza conteúdo essencial.
5. Sons rápidos do Curió: desligados por padrão e controlados pelo usuário.

As preferências ficam salvas no dispositivo por `localStorage`.

## Som
Enquanto os áudios oficiais não existem, o sistema usa sons curtos sintetizados via Web Audio API para:
- acerto;
- erro;
- missão concluída.

Quando os sons oficiais forem produzidos, substituir por arquivos curtos sem alterar a experiência de configuração.

## Hero em vídeo — plano futuro
Não implementar vídeo automático até existir material oficial. Quando for produzido:
- versões `webm` e `mp4`;
- imagem `poster` estática;
- 5 a 10 segundos, looping discreto;
- sem flashes;
- sem texto essencial dentro do vídeo;
- legenda/alternativa textual quando necessário;
- pausar ou substituir por imagem em `prefers-reduced-motion` e no modo de segurança para epilepsia;
- botão de pausar quando o vídeo transportar informação relevante.
