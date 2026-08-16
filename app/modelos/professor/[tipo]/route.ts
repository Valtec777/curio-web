import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createTextPdf } from "@/lib/simple-pdf";

const SUBJECTS = "Biologia | Ciências | Filosofia | Física | Geografia | História | Inglês | Línguas | Língua Portuguesa | Matemática | Química | Sociologia";
const GRADES = "1º ano | 2º ano | 3º ano | 4º ano | 5º ano | 6º ano | 7º ano | 8º ano | 9º ano | 1º ano do Ensino Médio | 2º ano do Ensino Médio | 3º ano do Ensino Médio";

const common = `COMO USAR ESTE MODELO\n1. Baixe este PDF e envie ao ChatGPT.\n2. Peça: \"Use o modelo Plumareli anexado. Preencha os campos mantendo exatamente os nomes dos campos e devolva um PDF pronto para importar no Plumareli.\"\n3. Baixe o PDF produzido pelo ChatGPT.\n4. No Portal do Professor, abra a tela correspondente e use \"Importar e preencher\".\n5. Revise todos os campos e escolha os alunos no próprio Plumareli antes de salvar.\n\nIMPORTANTE\n- Não coloque nomes de alunos neste PDF. Os alunos são escolhidos somente no sistema.\n- Não invente matéria ou ano fora das listas permitidas.\n- Datas devem usar o padrão indicado.\n- Se um campo opcional não for usado, deixe em branco.\n`;

const templates: Record<string, { title: string; fileName: string; body: string }> = {
  missao: {
    title: "MODELO PLUMARELI - MISSÃO",
    fileName: "modelo-plumareli-missao.pdf",
    body: `${common}\nLISTAS VÁLIDAS\nMATÉRIAS: ${SUBJECTS}\nANOS: ${GRADES}\n\nFICHA DA MISSÃO\nTITULO:\nMATERIA:\nANO:\nMASCOTE:\nOBJETIVO:\nDESCRICAO_ORIENTACAO:\nDURACAO_ESTIMADA_MIN: 20\nPRAZO: YYYY-MM-DD\nHABILIDADE_PRINCIPAL:\n\nQUESTÕES\nRepita o bloco abaixo para cada questão, numerando QUESTAO_1, QUESTAO_2 e assim por diante. Máximo: 20 questões.\n\nQUESTAO_1\nTIPO: MULTIPLA_ESCOLHA | VERDADEIRO_FALSO | DISCURSIVA\nENUNCIADO:\nALTERNATIVA_A:\nALTERNATIVA_B:\nALTERNATIVA_C:\nALTERNATIVA_D:\nRESPOSTA_CORRETA:\nRESPOSTA_REFERENCIA_DISCURSIVA:\nPISTA:\n\nREGRAS DAS QUESTÕES\n- Múltipla escolha: usar exatamente 4 alternativas e informar a resposta correta.\n- Verdadeiro ou falso: resposta correta deve ser Verdadeiro ou Falso.\n- Discursiva: alternativas ficam vazias; RESPOSTA_REFERENCIA_DISCURSIVA pode trazer uma resposta esperada para ajudar o professor, mas a correção continua manual.\n- A pista é opcional e não deve entregar diretamente a resposta.`,
  },
  material: {
    title: "MODELO PLUMARELI - MATERIAL / CADERNO",
    fileName: "modelo-plumareli-material-caderno.pdf",
    body: `${common}\nLISTAS VÁLIDAS\nMATÉRIAS: ${SUBJECTS}\nANOS: ${GRADES}\n\nFICHA DE PUBLICAÇÃO\nTIPO: ATIVIDADE_CADERNO | MATERIAL_APOIO\nTITULO:\nDESCRICAO:\nMATERIA:\nANO:\nCATEGORIA: PDF | IMAGEM | ARQUIVO | OUTRO\nPRAZO: YYYY-MM-DD\nPUBLICACAO: AGORA | PROGRAMAR | RASCUNHO\nPUBLICAR_EM: YYYY-MM-DDTHH:MM\nARQUIVO_FINAL: USAR_ESTE_PDF | ANEXAR_OUTRO_NO_SITE\n\nCONTEUDO_DO_MATERIAL\nA partir daqui, produza o conteúdo que o aluno deverá receber. Quando CATEGORIA for PDF e ARQUIVO_FINAL for USAR_ESTE_PDF, este próprio PDF poderá ser reaproveitado como o arquivo final no Plumareli.\n\nOBSERVAÇÕES\n- Para Atividade/Caderno, o conteúdo deve trazer instruções claras do que o aluno fará e poderá enviar depois para correção.\n- Para Material de apoio, o conteúdo deve ser informativo, organizado e apropriado ao ano escolar.\n- Se PUBLICACAO não for PROGRAMAR, deixe PUBLICAR_EM em branco.`,
  },
  avaliacao: {
    title: "MODELO PLUMARELI - AVALIAÇÃO",
    fileName: "modelo-plumareli-avaliacao.pdf",
    body: `${common}\nLISTAS VÁLIDAS\nMATÉRIAS: ${SUBJECTS}\nANOS: ${GRADES}\n\nFICHA DA AVALIAÇÃO\nTITULO:\nMATERIA:\nANO:\nDATA_HORARIO: YYYY-MM-DDTHH:MM\nCONTEUDO:\nOBSERVACAO:\nCRITERIO_NOTA: SEM_ESCALA | 0_A_10\nARQUIVO_FINAL: USAR_ESTE_PDF | ANEXAR_OUTRO_NO_SITE\n\nAVALIACAO / ARQUIVO PARA O ALUNO\nA partir daqui, monte a avaliação ou o material que deverá ser anexado. O professor continuará escolhendo os alunos no Plumareli.\n\nOBSERVAÇÕES\n- 0_A_10 corresponde à escala numérica de 0 a 10 já cadastrada no sistema.\n- Se não houver arquivo de avaliação, deixe apenas a ficha preenchida e o professor poderá remover/substituir o anexo antes de salvar.`,
  },
};

export async function GET(_request: Request, { params }: { params: Promise<{ tipo: string }> }) {
  await requireRole("teacher");
  const { tipo } = await params;
  const template = templates[tipo];
  if (!template) return new NextResponse("Modelo não encontrado.", { status: 404 });
  const pdf = createTextPdf({ title: template.title, body: template.body, footer: "PLUMARELI · modelo de criação para professor" });
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${template.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
