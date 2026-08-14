function cleanText(value: string) {
  return String(value || "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}
function pdfEscape(value: string) { return cleanText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function wrapLine(line: string, max = 94) {
  const words = cleanText(line).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const out: string[] = []; let current = "";
  for (const word of words) { if (!current) current = word; else if (`${current} ${word}`.length <= max) current += ` ${word}`; else { out.push(current); current = word; } }
  if (current) out.push(current); return out;
}
export function createTextPdf({ title, body, footer }: { title: string; body: string; footer?: string }) {
  const W=595,H=842,marginX=55,topY=785,bottomY=58;
  const lines:Array<{text:string;bold?:boolean;size?:number;gap?:number}>=[{text:title,bold:true,size:16,gap:8},{text:"",gap:5}];
  for (const raw of cleanText(body).split(/\r?\n/)) {
    const t=raw.trim(); if(!t){lines.push({text:"",gap:6});continue;}
    const heading=/^\d+\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(t)||(t===t.toUpperCase()&&t.length<100);
    for(const line of wrapLine(raw,heading?82:94)) lines.push({text:line,bold:heading,size:heading?11:9.6,gap:heading?5:3.5});
  }
  const pages:typeof lines[]=[];let page:typeof lines=[];let y=topY;
  for(const item of lines){const height=(item.size||9.6)+(item.gap||3.5);if(y-height<bottomY&&page.length){pages.push(page);page=[];y=topY;}page.push(item);y-=height;}if(page.length)pages.push(page);
  const objects:string[]=[];const add=(s:string)=>{objects.push(s);return objects.length;};
  const fontNormal=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBold=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageObjIds:number[]=[];const contentObjIds:number[]=[];
  for(let p=0;p<pages.length;p++){let yy=topY;const ops:string[]=["BT"];for(const item of pages[p]){const size=item.size||9.6;ops.push(`/${item.bold?"F2":"F1"} ${size} Tf`);ops.push(`1 0 0 1 ${marginX} ${yy.toFixed(1)} Tm`);ops.push(`(${pdfEscape(item.text)}) Tj`);yy-=size+(item.gap||3.5);}const foot=`${footer||"Documento emitido eletronicamente"} · página ${p+1}/${pages.length}`;ops.push(`/F1 7.5 Tf`);ops.push(`1 0 0 1 ${marginX} 30 Tm`);ops.push(`(${pdfEscape(foot)}) Tj`);ops.push("ET");const stream=ops.join("\n");const contentId=add(`<< /Length ${Buffer.byteLength(stream,"latin1")} >>\nstream\n${stream}\nendstream`);contentObjIds.push(contentId);pageObjIds.push(add("__PAGE_PLACEHOLDER__"));}
  const pagesId=add(`<< /Type /Pages /Kids [${pageObjIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageObjIds.length} >>`);
  for(let i=0;i<pageObjIds.length;i++)objects[pageObjIds[i]-1]=`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${fontNormal} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentObjIds[i]} 0 R >>`;
  const catalogId=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);let pdf="%PDF-1.4\n%âãÏÓ\n";const offsets=[0];
  for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf,"latin1"));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf,"latin1");pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(pdf,"latin1");
}
