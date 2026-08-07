import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

const assetsDir = path.join(__dirname, '..', 'assets');
const templatePath = path.join(assetsDir, 'oficio_template.docx');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_UP = MESES.map((m) => m.toUpperCase());

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function paraText(p: string): string {
  return (p.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]*>/g, ''))
    .join('');
}

function rebuildPara(p: string, newText: string): string {
  const openTag = (p.match(/^<w:p\b[^>]*>/) || ['<w:p>'])[0];
  const pPr = (p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
  const firstRun = (p.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/) || [''])[0];
  const rPr = (firstRun.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
  return `${openTag}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escXml(newText)}</w:t></w:r></w:p>`;
}

function buildTableRow(cells: string[]): string {
  const widths = [3256, 850, 1134, 2552, 2551];
  const borders =
    '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
    '<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
    '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>' +
    '<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
  const tds = cells.map((c, i) => {
    const align = i === 0 ? 'left' : 'center';
    return (
      `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/>` +
      `<w:tcBorders>${borders}</w:tcBorders>` +
      '<w:tcMar><w:top w:w="30" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="30" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>' +
      '<w:vAlign w:val="center"/></w:tcPr>' +
      `<w:p><w:pPr><w:pStyle w:val="NormalWeb"/><w:spacing w:before="0" w:beforeAutospacing="0" w:after="0" w:afterAutospacing="0"/><w:jc w:val="${align}"/></w:pPr>` +
      `<w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>` +
      `<w:t xml:space="preserve">${escXml(c)}</w:t></w:r></w:p></w:tc>`
    );
  });
  return `<w:tr><w:trPr><w:trHeight w:val="400"/><w:jc w:val="center"/></w:trPr>${tds.join('')}</w:tr>`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function buildSinPermisosParagraph(): string {
  return (
    '<w:p><w:pPr><w:pStyle w:val="NormalWeb"/>' +
    '<w:spacing w:before="120" w:beforeAutospacing="0" w:after="120" w:afterAutospacing="0"/>' +
    '<w:jc w:val="center"/></w:pPr>' +
    '<w:r><w:rPr><w:rFonts w:ascii="Arial Narrow" w:hAnsi="Arial Narrow"/>' +
    '<w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>' +
    '<w:t xml:space="preserve">No se solicitaron permisos administrativos para este mes</w:t></w:r></w:p>'
  );
}

export const oficioService = {
  async generarOficio(rows: { nombre: string; dias: string; desde: string; hasta: string; observaciones: string }[], month: string, ord?: string): Promise<Buffer> {
    if (!fs.existsSync(templatePath)) {
      throw new Error('Plantilla de oficio no encontrada');
    }
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const mesLower = MESES[monthNum - 1];
    const mesUpper = MESES_UP[monthNum - 1];
    const ordNum = (ord || '').trim() || '023';

    const hoy = new Date();
    const dd = pad2(hoy.getDate());
    const fechaLinea = `HUALPÉN, ${dd} de ${MESES[hoy.getMonth()]}  del ${year}.`;

    const data = await fs.promises.readFile(templatePath);
    const zip = await JSZip.loadAsync(data);
    const docFile = zip.file('word/document.xml');
    if (!docFile) {
      throw new Error('document.xml no encontrado en la plantilla');
    }
    let xml = await docFile.async('string');

    xml = xml.replace(/(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/g, (whole, openTag: string, inner: string, closeTag: string) => {
      const text = paraText(whole);

      if (/^PERMISOS ADMINISTRATIVOS/.test(text)) {
        return rebuildPara(whole, `PERMISOS ADMINISTRATIVOS  ${mesUpper}  ${year}`);
      }
      if (/HUALPÉN,/.test(text)) {
        return rebuildPara(whole, text.replace(/HUALPÉN,.*del\s+\d{4}\.?/, fechaLinea));
      }
      if (/correspondiente\s+\w+\s+del\s+\d{4}/.test(text)) {
        return rebuildPara(whole, text.replace(/correspondiente\s+\w+\s+del\s+\d{4}/, `correspondiente ${mesLower} del ${year}`));
      }
      if (/^\s*Ord\.\s*:/.test(text)) {
        return rebuildPara(whole, text.replace(/Ord\.[\s\S]*$/, `Ord. :  ${ordNum}/${year}`));
      }
      return whole;
    });

    if (rows.length > 0) {
      const rowXml = rows
        .map((r) => buildTableRow([r.nombre, r.dias, r.desde, r.hasta, r.observaciones]))
        .join('');
      xml = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) =>
        tbl.includes('Nombre funcionario/a') ? tbl.replace('</w:tbl>', `${rowXml}</w:tbl>`) : tbl
      );
    } else {
      xml = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) =>
        tbl.includes('Nombre funcionario/a') ? buildSinPermisosParagraph() : tbl
      );
    }

    zip.file('word/document.xml', xml);
    return zip.generateAsync({ type: 'nodebuffer' });
  },
};
