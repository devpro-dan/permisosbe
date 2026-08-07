import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

function fmtDate(v: string): string {
  const [y, m, d] = v.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function calcularDias(inicio: string, fin: string | undefined | null): number {
  if (!fin || fin === inicio) return 1;
  const d1 = new Date(inicio + 'T12:00:00');
  const d2 = new Date(fin + 'T12:00:00');
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
}

const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatearFechaLetras(fecha: Date): string {
  const dia = fecha.getDate();
  const mes = meses[fecha.getMonth()];
  const anio = fecha.getFullYear();
  return `${dia} de ${mes} de ${anio}`;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  opts: {
    headers: string[];
    rows: (string | number)[][];
    widths: number[];
    fontSize?: number;
    headerBg?: string;
  }
) {
  const ML = 45;
  const rowH = 22;
  const headerH = 24;
  const FONT = 'Helvetica';
  const BOLD = 'Helvetica-Bold';
  const BLACK = '#000000';
  const GOLD = '#FFC000';

  function cell(x: number, y: number, w: number, h: number, text: string, isHeader: boolean, align: string) {
    if (isHeader) {
      doc.save();
      doc.rect(x, y, w, h).fill(opts.headerBg || GOLD);
      doc.restore();
    }
    doc.strokeColor(BLACK);
    doc.lineWidth(0.5);
    doc.rect(x, y, w, h).stroke();
    doc.font(isHeader ? BOLD : FONT).fontSize(opts.fontSize || 9).fillColor(BLACK);
    const px = doc.x, py = doc.y;
    const pad = 3;
    const textOpts: any = { width: w - pad * 2 };
    if (align === 'center') textOpts.align = 'center';
    doc.text(text, x + pad, y + (h - doc.heightOfString(text, textOpts)) / 2, textOpts);
    doc.x = px;
    doc.y = py;
  }

  let x0 = ML;
  doc.font(BOLD).fontSize(opts.fontSize || 9).fillColor(BLACK);
  opts.headers.forEach((h, i) => {
    cell(x0, doc.y, opts.widths[i], headerH, h, true, 'center');
    x0 += opts.widths[i];
  });
  doc.y += headerH;

  opts.rows.forEach((row) => {
    x0 = ML;
    row.forEach((val, i) => {
      cell(x0, doc.y, opts.widths[i], rowH, String(val), false, i === 0 ? 'center' : 'left');
      x0 += opts.widths[i];
    });
    doc.y += rowH;
  });
}

export const reporteService = {
  generarReporteGeneralPDF(permisos: any[], filters: { employee?: string; startDate?: string; endDate?: string; year?: number }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 45 });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.fontSize(19).text('Reporte General de Permisos Administrativos', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Filtros: ${filters.employee || 'Todos los funcionarios'} | Año: ${filters.year || 'Todos'}`);
      doc.text(`Período: ${filters.startDate || 'Inicio'} a ${filters.endDate || 'Actualidad'}`);
      doc.text(`Registros: ${permisos.length}`);
      doc.moveDown(0.6);

      const headers = ['N°', 'Funcionario', 'RUT', 'Desde', 'Hasta', 'Días', 'Estado'];
      const widths = [30, 140, 75, 70, 70, 50, 70];
      const rows = permisos.map((p, i) => {
        const estadoLabel = p.estado === 'en_revision' ? 'En Revisión' : p.estado === 'aprobado' ? 'Aprobado' : 'Rechazado';
        return [
          i + 1,
          `${p.nombres || ''} ${p.apellido_paterno || ''}`.trim(),
          `${p.rut}-${p.dv}`,
          fmtDate(p.fecha_inicio),
          p.fecha_fin ? fmtDate(p.fecha_fin) : '-',
          calcularDias(p.fecha_inicio, p.fecha_fin),
          estadoLabel,
        ];
      });

      drawTable(doc, { headers, rows, widths });

      if (permisos.length === 0) doc.text('No hay permisos para los filtros seleccionados.');
      doc.end();
    });
  },

  generarReporteTrabajadoresPDF(
    trabajadores: any[],
    maxDias: number,
    filters: { employee?: string; startDate?: string; endDate?: string; year?: number }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 45 });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.fontSize(19).text('Reporte de Días de Permiso por Trabajador', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Filtros: ${filters.employee || 'Todos los funcionarios'} | Año: ${filters.year || 'Todos'}`);
      doc.text(`Período: ${filters.startDate || 'Inicio'} a ${filters.endDate || 'Actualidad'}`);
      doc.text(`Días máximos por trabajador: ${maxDias}`);
      doc.moveDown(0.6);

      const fmtDias = (v: number): string => {
        const rounded = Math.round(v * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
      };

      const headers = ['N°', 'Funcionario', 'RUT', 'Cargo', 'Disponibles', 'Tomados'];
      const widths = [30, 140, 75, 95, 75, 70];
      const rows = trabajadores.map((t, i) => [
        i + 1,
        `${t.nombres} ${t.apellido_paterno}${t.apellido_materno ? ` ${t.apellido_materno}` : ''}`.trim(),
        `${t.rut}-${t.dv}`,
        t.cargo || '-',
        fmtDias(t.dias_disponibles),
        fmtDias(t.dias_usados),
      ]);

      const totalDisponibles = trabajadores.reduce((acc, t) => acc + t.dias_disponibles, 0);
      const totalUsados = trabajadores.reduce((acc, t) => acc + t.dias_usados, 0);
      rows.push(['', 'TOTAL', '', '', fmtDias(totalDisponibles), fmtDias(totalUsados)]);

      drawTable(doc, { headers, rows, widths });

      if (trabajadores.length === 0) doc.text('No hay trabajadores para los filtros seleccionados.');
      doc.end();
    });
  },

  async generarReporteGeneralExcel(permisos: any[], filters: { employee?: string; startDate?: string; endDate?: string; year?: number }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reporte General');
    sheet.addRow(['Reporte General de Permisos Administrativos']);
    sheet.addRow(['Funcionario', filters.employee || 'Todos', 'Año', filters.year || 'Todos', 'Desde', filters.startDate || 'Todas', 'Hasta', filters.endDate || 'Todas']);
    sheet.addRow([]);
    sheet.columns = [
      { header: '#', key: 'id', width: 6 },
      { header: 'Funcionario', key: 'funcionario', width: 32 },
      { header: 'RUT', key: 'rut', width: 15 },
      { header: 'Fecha Solicitud', key: 'fecha_solicitud', width: 18 },
      { header: 'Fecha Inicio', key: 'fecha_inicio', width: 15 },
      { header: 'Fecha Fin', key: 'fecha_fin', width: 15 },
      { header: 'Días', key: 'dias', width: 10 },
      { header: 'Jornada', key: 'tipo_jornada', width: 15 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Motivo', key: 'motivo', width: 40 },
    ];
    permisos.forEach((p) => sheet.addRow({
      id: p.id,
      funcionario: `${p.nombres || ''} ${p.apellido_paterno || ''}`.trim(),
      rut: `${p.rut}-${p.dv}`,
      fecha_solicitud: p.fecha_solicitud,
      fecha_inicio: p.fecha_inicio,
      fecha_fin: p.fecha_fin || '',
      dias: calcularDias(p.fecha_inicio, p.fecha_fin),
      tipo_jornada: p.tipo_jornada,
      estado: p.estado,
      motivo: p.motivo,
    }));
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.getRow(4).font = { bold: true };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  },

  generarPDF(permisos: any[], usuario: { nombres: string; apellido_paterno: string; rut: string }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.fontSize(20).text('Reporte de Permisos Administrativos', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Trabajador: ${usuario.nombres} ${usuario.apellido_paterno}`);
      doc.text(`RUT: ${usuario.rut}`);
      doc.text(`Año: ${new Date().getFullYear()}`);
      doc.moveDown();

      doc.fontSize(10);
      permisos.forEach((p, i) => {
        doc.text(
          `${i + 1}. ${p.fecha_inicio}${p.fecha_fin ? ` - ${p.fecha_fin}` : ''} | ${p.tipo_jornada} | ${p.estado} | ${p.motivo}`
        );
        doc.moveDown(0.5);
      });

      if (permisos.length === 0) {
        doc.text('No hay permisos registrados en este período.');
      }

      doc.end();
    });
  },

  async generarExcel(permisos: any[], usuario: { nombres: string; apellido_paterno: string; rut: string }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Permisos');

    sheet.columns = [
      { header: '#', key: 'id', width: 5 },
      { header: 'Fecha Solicitud', key: 'fecha_solicitud', width: 18 },
      { header: 'Fecha Inicio', key: 'fecha_inicio', width: 15 },
      { header: 'Fecha Fin', key: 'fecha_fin', width: 15 },
      { header: 'Tipo Jornada', key: 'tipo_jornada', width: 15 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Motivo', key: 'motivo', width: 40 },
      { header: 'Motivo Rechazo', key: 'motivo_rechazo', width: 40 },
    ];

    permisos.forEach((p) => {
      sheet.addRow({
        id: p.id,
        fecha_solicitud: p.fecha_solicitud,
        fecha_inicio: p.fecha_inicio,
        fecha_fin: p.fecha_fin || '',
        tipo_jornada: p.tipo_jornada,
        estado: p.estado,
        motivo: p.motivo,
        motivo_rechazo: p.motivo_rechazo || '',
      });
    });

    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },

  generarCertificadoAprobacion(permiso: any, usuario: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Register Arial Narrow font if available on Windows
      const arialNPath = 'C:\\Windows\\Fonts\\ARIALN.TTF';
      const arialNBPath = 'C:\\Windows\\Fonts\\ARIALNB.TTF';
      const hasArialN = fs.existsSync(arialNPath) && fs.existsSync(arialNBPath);
      if (hasArialN) {
        doc.registerFont('ArialNarrow', arialNPath);
        doc.registerFont('ArialNarrow-Bold', arialNBPath);
      }
      const FONT = hasArialN ? 'ArialNarrow' : 'Helvetica';
      const BOLD = hasArialN ? 'ArialNarrow-Bold' : 'Helvetica-Bold';

      // Embedded logo images from formato.docx (base64)
      const logoLeftB64 = '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';
      const logoRightB64 = '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';
      const footerBarB64 = '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r7/+OgB5eXlceeWVXHXVVbz88stkZmZy3XXXcf311/PKK69w6tQpDhw4wLhx43jrrbcAuPvuu4mIiMDf37+8vAMGDCA0NJQf//jHCvqLiIiIiIiISC2rdhmbLdvuYtmGTZyRn09wSBijR51Pn+7d2LRtB298uJoL+g0E4MSevcz85bN8dPwEF44cwYQJE/jxj38MwDnnnMOvfvUr3n//fd5//33mzZvH/Pnz+ec//1n+vqSkJNq3b0/r1q0JCgry9G6IiEdZv349L7/8MoMHD+biiy/G5XKxfft2PvzwQ7Zt28b+/fs5efIkW7du5aKLLgIgMDCQp59+mhUrVjB9+nTuu+8+Vq9ezYoVK4iNjQVg69atzJkzh759+zJ27Fi6d+/OnXfeye23386kSZPo168fL774IpZlAXD++ecTEhICwHe+8x26d+/e2LsuIiIiIiIiItKLVRvsn/HpemLeI+KnP03ntFN788Gqj/nT36x5OgAAIABJREFUwkWc07cfAH89cYLOTZrQ3W7nnHPOYdKkSSxcuJCRI0cSERHBa6+9VmHdZ511FmeccQYAH3/8MQsWLGDu3Lm8//77ZGZmApCUlERSUhIdOnQgPDxcs/tFpBu3282XX35JUFAQAwcO5O2336ZwB9e3W+92uzl48CCHDh1ixIgRXH755XzwwQc8++yzrF27lv379zNlyhTmzp1LUlIS69at48iRIwQFBQHw0ksvMXHiRG6//XamTp3KHXfcwZ49eyqUo02bNkyYMAFQ7wARERERERERqX3V3tm3oKCA0qIicux2EpKSaNO+AyUlTk4dPUpsVBSgRP5G4XA4WLBgAb169aJ58+bV/j4sLIwOHTqUf7127VqefPJp/vrGm6zfsJGcvDwK7XaK7HYKbTYKbSVKIPGgjIwMioqKcDqdlV6r69ato3v37gA0b96cSy+9lOeff55zzz23WsG6ZVlMnTqVDRs2MGnSpDoosYiIiIiIiIiIVFe1d+y12+2U2u2U2m3kmj/79u6hqLCQwKAgTO0FtX9KGpHWrVtzww03cP311/P6669z77338pe//IWHHnqIW265hTfeeIOTJ08SFhZGWFgYYWFh+Pn51Um5bDZbne2biNQfp9PJFVdcwQsvvIDD4cDtdjfY526z2SgsLGyQz5by54TT6az3dUqdTidXXHEFzz77bIPtQ2NzOBwNct2LiIiIiHgrPUtspHr16sXNN99M48ftdjtTp07F29R0O4KCgoiLi+P48eO8/fbbLF26lClTpnDuuecydepUvv3tbzN8+HCmTZsGwBtvvMHMmTNZsGBB+a3kQ0NDCQsLIzw8nKCgoBoXoFc0XkQ8y5133sncuXNxu90NVhar5CD+nnvuoU+fPpxzzjkNuo/y30fj4+P5v//7P8/+P9u3smrVKm644QYyMjI8XZTaduWVV/Liiy9SUlKizH4RERERqZDmEfWYKVOm8Kc//Yn9+/d7uij1avaMWZ7eBakFEydOZP/+/bRu3ZrY2NiK23e73S4SEhK45557yM7OrnK/fX19iYqKIjk5mW3btvHoo4+yYsUK3nnnHR5//HGSk5MJCAhgwIABDBo0CIBly5bx1ltvsXXrVs6cOUN2djY2m43Y2Fh69uzJmWeeWetBpuLiYvLz8yksLKz2bduLioo4efJkHZZQREREREQaUlVVV3Z7MXZ7r394u6ZNm/qHV36X0+ksLCyktLTU08WtM+5GiJu7XC4KCgqIPyiP6XK5sCwLq8rObN/1ZxoK30YQc5lroqSkhJUrV/LJJ5+wa9cu9u7dy6FDhzhz5gz5+fm1Hkxv3rw5N954I++88w4ffPABOTk5vPPOO0yZMoVu3brhcrkICAjgwQcf5K233sJms+Hn50fHjh0BuOyyy/jnP/9JWFhYze+RVKisrIycnBxOnz7N6dOnycnJobS0FDuYz49q/rH/UglERERERKQhVXVH36KiIvLz8ykoLKTI4cBpXjt9+nTTXp8+fUz79u1NXFycCQoKMi1btjRBQUGmVatWJigoqPz1tm3bmn79+pkRI0aY8ePHm5tuusk89NBDZubMmeatt94yLpfLU7ssIiIiIiIiItIgqqrZ79y5k/nz5/Pee+9x4sQJXC4XF5IYHc2lX72cyZMnV9h+8+bNvPnmm6xatYpdu3aRmZkJoHv5ioiIiIiIiIiI9Dg90UxERERERERERETqgQJ9IiIiIiIiIiIiUscU0BMREREREREREZE6poCeiIiIiIiIiIiI1DEF9ERERERERERERKSOKaAnIiIiIiIiIiIidUwBPREREREREREREaljCuiJiIiIiIiIiIhIHVOkQkREREREREREROqYHrcnIiIiIiIiIiIidUwBPREREREREREREaljCuiJiIiIiIiIiIhIHVNAGxEREREREREREaljCvSJiIiIiIiIiIhIHVNAFhEREREREREREaljCvaLiIiIiIiIiIhIHVOwX0REREREREREROqYHrcnIiIiIiIiIiIidUwBPREREREREREREaljCuiJiIiIiIiIiIhIHVNAGxEREREREREREaljCvSJiIiIiIiIiIhIHVNAFhEREREREREREaljCvaLiIiIiIiIiIhIHVOwX0REREREREREROqYgnoiIiIiIiIiIiJSxxToExERERERERERkTqmgJ6IiIiIiIiIiIjUMQX0REREREREREREpI4poCciIiIiIiIiIiJ1TIE+ERERERERERERqWO6jZ6IiIiIiIiIiIjUME1NT6S2hISEEBgYiI+PDwEBAQQFBRESEkJ4eDixsbEkJCQQExNDSEgI3t7e+Pv7m507d3q6yNKDOJ1OSkpKKCsrqwG/REQaw4kTJzh79myt7Kvb7aa4uJhTp07hcrlq5TNEREREpHEo2F9LSp2llDnLKCwsZN/xY6xYv54PVq3ivTVrWL9lC9v27uXAkSOcPnOGQoej1j8/OiKCb/Tpw/lDh9K3Z08ump6L1/1ZPC4uDi8vH34+Pvj7+9OtWzeGDh3KqFGjGDNmDOeccw4DBgwgJSWF6Oho+vXrh9Pp5J133vF0kUUEwOV2c7KggP0nTvDJ3r2s3b6dj3fuZM2OHazZvZvPNm/m82HD+PzgQQ6lp1NYXExjX35d4+IYd+GFTLrgAr4wYgQThg5lwuDBjD3/fMaMGEF6YSG/3ryZEqezUctVWVnCw8MJCAjA19eX0NBQYmJiiI+Pp1WrViQnJ9OuXTuSkpIIDQ3F29sbf39/lixZ4ukiS0+R+xM3cnuB+/79b9/ff/u+kPWVzVf3dmnc50NTeuIJJz5eNnx8bPj7++Hj44OPj7d5bN/988rff/3171+5/X3qXt8yIiI9Tb2DGlCTJk3o3rUrEy+8kIkXXsi4Cy/kK0OHcs4ZZzB48GAGDBhAYmIiXbt2ZfDgwZx55pn07dsXgGeffZY1a9ZQXFLi6d0QqZK3tzctmzcnOjISu91OUVERThVcpAc5Sks5npXFe1u28PfVq3n1ww/5+4oVzFu5kg82b+ZwRgalDQmg+xIeFkZsl64k9uxJSv/+nN23L4k9etCxY0datmxJ69at6dK5M/Hx8QD069ePxx9/nO3btzd4OevSF62SX375ZQQHB3PDDTd4ujhSjyzLwul0ciYzk3WbN/PJ5s2s/eQTdu/fz4mMDBxOJ41xyz6bRaBVCkF+rYiJjCQ2KoqYqCiiIiKI7NSJNq1b079PH5o1a0a/fv0oKCjg448/5nBGhqd3pc75+PjQvHlz2rVrR9u2bWnfvj3t2rWjefPmtGnThtatWxMbG1v++sGDBz1dZOkJpaWcKCjgQHo6B9LTOZiRwYFTpziQns7BjAwOnDrFgfR0DmZkcCA9nYMZGRzIyMCrlpFWUwUFsKtIX0EBoPWHRHzGjx9PUVGR+a///Z4pLSs1JaWlpqyszNhMfZQpLi42JcXFprS01BQWfV3U8tcXLVpk7HZ7tffXy9vbpKSkmJSUFNOnTx+TkpJiOnToYLp27WqGDBliLr30UnPdddeZGTNmmOeff95s2rTJlJSUmIKCAlNQUGCKi4s9vdsi4kV69Ohh3nnnHXPw4EHjdDqrbMci4mm5Vmheefddc8mPfmROGT7ctO3WzbRu3950SE01B/PzzcmCApNTWGiKHA6v+F/KZn6X2H6n+vr3fp3aJTjYBAUFmdGjR5uxY8eaiRMnmmPHjjXK/rvdblNYWGguueQS83//93+msLDQ00WTOma325hbt3HjRjNu3DjTq1cv07p1axMfH2+ioqJMVFRU+eukpKQYh8NhHG53Jfvr8f+u3txG5XtsMv5m81k2E2Sz+ZvmzZubrl27mmHDhplrrrnGPP744+bll182p0+fbtD2X1c9b7xRtM/+fn4mJiLCpKSkmJSUFJOSnGxSUlJMSnKySUlJMcnJySYpMckkJSWZlJQUk5KSYlJSUkxycrJJSkoyycnJdVL+6n4HwHPPPVftz0tISDBdunQx3bt3N127djUdO3Y0nTp1MnFxcZ4uoki5Hj16mHXr1pnDhw+b0tJSTxeHGj0YiYiIiDdRAE68kq+vLzExMfTo0YNLL72UW2+9lZtuuonbbruNmTNncu+997J06VKeeeYZLlDlQ0R6yGdnznDX/PmMe/xxPty+nRKn09NF8hheXl6mY8eOZtasWWbYsGGmQ4cOZsaMGaawsNDTReuWeo1Iw4qOjjbz5883ubm5Ztu2bebOO+80V155pbnyyivNlVdeaSZNmmTmzJljsrOzG7ScAQEBJioqqkE/Q6TQRs2rV68ea2JerFkzPt60iZx8d5f9KIpsVPl6oX3rEg4cOMCqVavYsGEDe/bsoUmTJnzwwQdmwYIFlJe1Tupno/w3VKK+BPp/r5fzqcJ1vP/+++bTTz9tkM+oDT4+PiYyMtK0adPGdO7c2XTp0sVER0d7ulgixMUFm1YtmpsuXbqYhIQE06ZNG9OqVSvTpk0b07FjR9OrVy8zYMAAc95555lrrrnGTJ8+3fzxj380v/71r81vf/tbTxcdBJg3b56niyAiIiIiIiIiIi0rISDA9OvXz0yYMME88cQT5uOPPzYul8s4HA6zY8cO89RTT5mLL764zj43Pj7eDB482CxbtswUFBQ0YOl6h2r2IiIiIiIiIiIi3kTP4BaP53A42LFjB8nJyXTv3h2AyMhIrrzySubNm0d8fDy9evXivPPOIyIiolbLkZ+fz6FDh+jUqRNJSUm1+vkiIiIiIiIiIiIiIl1RMF1ERERERERERETqmAJ6IiIiIiIiIiIiUscU0BMREREREREREZE6poCeiIiIiIiIiIiI1DEF9ERERERERERERKSOKaAnIiIiIiIiIiIidUzBPhEREREREREREaljCuiJiIiIiIiIiIhIHdNt9ERERERERERERKSGKdgnIiIiIiIiIiIidUwBPREREREREREREaljCuiJiIiIiIiIiIhIHVOPOBEREREREREREaljCvaLiIiIiIiIiIhIHVNAVkREREREREREROqYHrcnIiIiIiIiIiIidUwBPREREREREREREaljCuiJiIiIiIiIiIhIHVNAFhEREREREREREaljCvaLiIiIiIiIiIhIHVNAVkREREREREREROqYHrcnIiIiIiIiIiIidUwBPREREREREREREaljCuiJiIiIiIiIiIhIHVNAFhEREREREREREaljCvaLiIiIiIiIiIhIHVNAVkREREREREREROqYAnoiIiIiIiIiIiJSxxToExERERERERERkTqmgJ6IiIiIiIiIiIjUMQX0REREREREREREpI4poCciIiIiIiIiIiJ1TME+ERERERERERERqWMK6ImIiIiIiIiIiEgdU0BPRERERERERERE6pge5yciIiIiIiIiIiK16PDhw5SVlXl0HxTQExERERERERERkTrm4+NDaGiop4tRTgE9ERERERERERERqWPBwcGeLkIFCuiJiIiIiIiIiIhIHVNAVkREREREREREROqYAnoiIiIiIiIiIiJSxxToExERERERERERkTqmgJ6IiIiIiIiIiIjUMQX0RBrQnj17PF0EERERERERERGRC6Zgn0gt2L17N26329PFEBERERERERGRRqJgn0gtyM3N9XQRRERERERERESkkSgKJyIiIiIiIiIiInVMAT0RERERERERERGpY7rdnoiIiIiIiIiIiNQwBfRERERERERERESkjimYJyIiIiIiIiIiInVMAVkRERERERERERGpY3rCnojUWm+IpJQU4uLiCA8Pp1mzZkRERBAUFERYWBhNmjQhODiY3bt3e7qIIiIiIiIiItLIKis4q/4nUktaZEQiHR1JbNCOUF9fgoOCREREeLooIsAr//wXn+w/4OliiIiIiIiISM+gqKjI08UAoNm/jL4hXTuz+JabmH3jDUzufhoAwaGhnNOrF2OGD+c7l1/OyCFDAPjwhRd4e/lydhxO93Txu+3YRx9xz1/+wqwdO0hJSaGFl5ev2bNnExERQWRkJM2aNSMqKoqoqCh8fX09XcweEX7aaZz/n9/LNddcQ5MmTTxdHGlgycnJ/PFPfyI5KQmAsLAwAFJTU4mNjaV79+4NVi6bzcY7y5bx+sqVrcrLy8sTERFBixYtiI+Pb7Cy17frr7+elJQULr/8ckD9fKThfb57N6/Pf5ft27YRExPDqFGj+MpXvkJCQoKniyY9SFNTEwkKCiIhIQF/f3+aNWsGyHhWRKQhVFZpb9++PatWrfJY2TQ1VbyF3W4nIjyMhPh42rZpw5ZNm1j87ru83d9Bx1P2c/jUi6z95CMWbthAgM1Gz969GdS3L5d+9atc8+VLELsXh0+m12q5/Ly8aBkXR8e2benVowctqlhuz5497Nq1i+zsbE+87b/KdDw9neUbNgCwZedODmdkeLpIUk+sSXbLaj2x1nRTU5NZsmSJ2bBhg+nTp4/x8vIyTqcTy7KwLAu3243L5SLH8jJFRUUm3OY2CX47TXRSkkns2NEkJyeb5ORkY7fbjWVZsixPv2/HjBljwNuYzWYzERERpnfv3uY///mPZ9rKhRgQ4De2fz8THh5u/vjHP5rXXnutXsZKqd+YMWPM0KFDSYmKMsnJyaZJkyYmODjYBAUFGR8fHxMTE2OaNW1qunXrZiZOnGi2bNli3G63KSoqavDyl5aWmiOHDplPtm83y1auNMtXrTKr1q41a9avN+s2bTLrNm0y6zZtMh+tW2c2bNliNm3darZu3Wq2b99udu/ebaKioszEiRNN69atTXR0tDFKDpFG43Q6zdtvv21SUlJMjx49TElJiSkpKTEFBQUmNzfX5OTkmKKiImM1cm+L4uJiU1JSYk6fPm3OnDljMjIyzLFjx8yxY8fMkSNHzNGjR82xY8eM2+02BQUFnirdBbHb7SY2Nta0adPGlJSUeGzqxqBBg8yaNWs8Ur5P1q41KX36mClTppilS5eatWvXmnXr1pW/djgc5s033zTdu3c340aMMLNmzTInTpwwH330kRk6dKiJjY01l156qcnJyakwQNGjRw+zfPly4/BYnY/6P6O4uNgcPHjQbN++vXysXLt2rflkyxaz9957zVmzZpl58+aZRYsWmaKiIk8Xt8H5+PiY5557ziQkJHhkjI6Li/NoGxCpyrhx40xISIh5/PHHzZ49e0xpaamji+zmdDo9NjY7HA5TUFBgCgsLjbO01BQVF5ui4mJjq+J9ERERli5dapKSkuq1XJdeeqnZunVrvex7RUV61cTExJjo6GiTnJxskpKSTGBgYLX2PTY21pw+fbrey18T5f3nP/9pOnToYNq2bWvatm1r2rRpY9q3b2/atm1r2rVrZ3r06GEmTZpkLrvsMrNv376G3h2RGquNwkbr/8av/e9n3D01PYE6NHToUNO0aVMzcuRIU1JSUuuflZycbBYsWFDhnXJyckxubm6dH3eNLSsry5SWlpoTJ0549kD0EqGhoebBBx80mZmZxhCmf/Vq5Vf4f9YP/F9iLr/8cvPggw+ao0ePmgMHDphp06aZmJgYExUVZT788EPTpEkT069fP7N+/XoPllxEOpJmzpw50/z3v/9t0gKTJk0y06ZNM4WFhQ1YyLqRlZVljh075uliiEj/HmY62s2yZcuMw+EwIy+91NhsNpOdnd2QgwAV+rbl5eWZ3bt3m/3795uSkpJ/9Yn0bu+//75p3769iY+PN88884yZP3++eeutt8zbb79t3nrrLfPWW2+ZBQsWmHnz5pm77rrL9O/f38TExJhLL73UPP/882bu3LnmueeeM++884556aWXTGlpqaeL3YXFixeb1NRUk5qaalJTU01KSoqJj483ycnJpk2bNqZz584mIiLCLF261GRkZFR4T2lpqUlPT/eVYyaybds2s2XLFrNlyxazZcsWs3nzZvPFF1+YL774wmzevNnY7XYTFBTk6WJ3mdM/ZcoU4+fnZ+bNm+eZ/d+zx3zh5WViYmJMcHCwiYqKMqGhoVX+/2Sz2UxaWpo5c+ZMfR4mDb4/mzZtMoMHDza+vr7m4MGDxul0mqKiIlNUWGgKCwpMYWGhKSwoMIUFBSY3N9cUFhaaoqIic/bsWZOfn2/Onj3r6d0RETlPfHy8ady4MvX9mN0Qk3l8B/tEREQ8Tc9rKKSbg4jHlJaW8t577/Gd73wHgFGjRrFkyRIAli5dSnJyMsuXLycsLIzrr7+e66+/HoDjx48DkJ6eXsu/NqSBBAcHExISQosWLWjVqhWxsbE0b96ckJAQAn7zm3Z79+7l9ddfp0WLFrz44osN+nvLysrIzs7m+PHjnDx5ktOnT5OZmUlOTg55eXnk5+eTl5dHrteXFRoayoQJE/jzn/9MSkoKp512Gv+zfyG9PYX5+fT/z7M0DDwCunR+34JXEEcdARkZGWzbtq3C77H8/UZ6d/t0OBwUFBQAkJKSAsAFlE4aqG/fvmRlZZGTk0NsbCx2ux1/f38iIyNp3bo1nTp1omPHjrRt25aoqCgAvL29CQ0NZciQIZSVlfH6668TFBSEr68vkZGRDBgwgICAAI8cFwEBAQQEBDD8zDM5lJ7Or7ZtY3SPHuR/+ctcP3o0zz/3HNOGD+f2225j4tChvPnmm2zcuJGUlBQuueQS5s2bx5133llhmteMGTP44x//yP/8z/+wcOFCBg4cSFlZGQ8//DCPPPIITz31FD/96U/5+c9/XqHMRUVFHDlyhJ49exIXF1erv5fM8e6j53Fc7Nq1i+7du9OiRYtq76NlWbRq1Ypjx45RXFxMly5d6vd3crnycxgUFETv3r157bXXiI2N5eTJk1XOWrHb7YSHhzNs2DDmzZvHuRdcwH0PPsikO+9k4H/+Q4cOHSr8btKkSRW+vu+++1T+lUbUrFkzLrvsMvr06UNkZCTNmjXjnHPOoW/fvgQHB1f4+TXXXENOTg4jRowgJSUFy7IYPXo0t9xyC0899RQpKSkMGDAAp9PJjTfeyCeffMKVV17JkiVL6NixI1OmTGHGjBlMnz6drl271n+hlNiEiIiINB4F9EQ8YOTIkUyePJmrr76auXPnYlkW++67j02bNvHee+/xxBNPsH37dlJTU+nfvz+lpaWkp6eTnp5OYmIiAKNGjWLlypWe3o0aCQoKokePHpx66qmceeaZ9O7dm/j4eCIiIoiOjiYqKorIyEjCwsII+p//CWDs2LGcf/75xMXF0bt37wb5zSUlJRw+fJhNmzaxceNGtmzZwo4dOzh58iSFhYUMO6CL8cSJE1x33XUMHjyYQYMGccstt7BkyRJ27tzJvn37OH78ONnZ2eTk5JCXl+f1K3EkJCTw6KOPct111zFjxgz++te/cuzYMX499DQ+P+ocQKNWw4gMD2fkiBEMOfVUOnToAEBcXBxz5swhLy8PgJbFdsK+9QjpP32QDp+N5sBvdvPR5q387YUXuPHGG5k7dy5Op5P27dvzwQcfkJOTw+HDh9m/fz8HDhzgwIEDHD58uHw/MjMzOXDgAPv27SMjI4P9+/ezb98+9u/fz4EDB8jMzCQ/P5/8/Hzy8/MpKCigqKjI07vYqCzL4tSpU/Ts2ZMrrriCTz/9lI0bN/LFF1+wfft2VqxYwdq1a1m9enX5OXrmmWfy/PPPU1BQwGGHk4yMDJ599lnmzZvH9ddfX+H9S5YsYfXq1bzxxhtcddVVfPTRR+Tn5/Pmm28yfvx4fvnLXzJixAi3bFwNAAAgAElEQVTi4+P58MMPmThxIn/5y18IDAxk//79tChx0mT+PDq+/iptn3iMoAMHiI+PZ+DAgXifb34DS01N5dVXX2XChAk1eo+fnx+9e/cmPz+f1NRUj0xn69KlCy+99BKDBg0iPT2dTZs2sWXLFrZs2cLWrVvLz5tt27bxxRdfkJ+fX2GZs2Xv3r0AzJkzh1dffZWXXnqJ2267jaKiIh599FGeffZZ/vCHP1Tbgw8+yFlnnUVGRga//e1v+e53v1vhmJ84cSIzZ85k5MiR9OnTh08//ZQVK1aQm5vL2rVrmTBhAi+88AJLly5l+fLlFBYW0qxZM0aOHMmZZ55J9+7duf/++9m/fz979uxh586d7Nmzh4yMDA4dOkR2drbXN4mIiIg0BgX0RDxg7ty5dO3ala5du3LllVeSnJzM7t27sdvt7Nmzh7Vr1/Lxxx+zYcMGJkyYQOvWrSkpKSE9PZ309HRat24NwIABA9ixY4end6NaIiMjGTp0KF//+te57LLL6N+/P3FxcTQbNozMli3JbNmSYp+PMOu3p/DQhJHMvWcSN930P/Tp04fo6GjCwsLq9be63W5Onz7NJ598wuLFi1m4cCELFixgx44dAJzev5/eWVl4e3vTtm1b2rVrR5cuXTj11FPp168fZ599NqmpqcTGxtKkSRNCQ0MJDQ31aFZfdfj4+DB16lTmz5/P2LFjGTFiBIcPH+bs2bPceOONjBkzBlByhUjXLMsq/1mXLl1ISUlh3759zLn4Yn6ycyfLS0qY3Ly5Wze73aeFhYXRv39/BgwYwCmnnMKpp57KKaecQmpqKh06dAAgJyeHt99+m0WLFrF48WLWrFkDwNb9+9l34gSFNm9bCFFqYt++fURERNCnTx/i4+OZMGECfrPnMnlGfy7/dTFPPfUU27dvZ/369QwaNIh77rkHgM2bN5OXl8fYsWPZv38/f/zjH7n22msJCAhgzpw57Ny5k8mTJ/PFF18wevRopk2bRl5eHk8++STr1q3jvvvuY+TIkeUZ3IMGDWLjxo3069ePvn37cuDAAUangXPTpjH2ueeYMH48TZs2JTY2lrS0NI4fP0724D2I0YUAApQMXB3GqG3LhQgMDGThwoXMmjWL5s2b12jqzXmPRjO+tdlXNYqIiIiYqjP7XT7eJkI3ohfxhJKSEhYvXszChQt5+OGHmTBhAjabjaZNm5KcnMzSpUv529/+hjEGp9PJjh07+PDDD3nqqaf46U9/ypYtW4iLi+PWW2/lmWee8cju/Oc//2HXrl307t2bHj160KNHjwppFTabjZiYGPfp3cB3A0lJSaFly5ZcdNFF/OxnP2Py5MncfvvtXQaUr7/+eu677z7mzJnDnXfeidPp5MMPP+TDDz8kKiqK733vezz00EN06tSJNm3a0L59exITE4mOjqZJkyY4HA5OnTpFWloaaWlpFBYWNvYhUGOCgoIYPnw4R48eZc2aNVx22WXccccd/PKXv6xz5IEkAAAgAElEQVTQoUM88sgjRa+88soVn3/+OQMGDKBTp04sWrQIgAMHDhASEsKpp55Kp06diI+PZ/r06axatYqnnnoKgEMHD/LdI0cIDg5m586drFmzhpUrV/LJJ59w+PBhCgsLiY2NZdSoUfzgBz9gyJAhXfpVFBQUsG/fPo4cOVK/rbKL3G43Bw8e5MCBA+Tk5PDVV19x6tQppk6dysqVK2nXrh0lJSVMaJXJtu+NI2b0N+lThw4dYvr06cycOZMrr7ySqVOnYm2Yy5DZ83j3+/ex+b4ZzBw7msWLF3PHHXewbds2fvazn7Fp0yaOHj3KzJkz2blzJ+3ateOGG27gmWee4YM/PMBpFw3l0C0/kj/sG/zH6guLi4tp1aoVM2bM4KmnnqJz5848//zzbNq0ib/85S+kpKTQrFkzpkyZwpo1a/jhhRex6MKL2bpxI6+//jrPPvssHTt2ZOLEiexetoz4e+7hqVmzOOOMM3A6nSxYsIAlS5bw+9//npEjRzJy5Eiuu+46CgsLmThxIkuXLmXevHk8+OCD5OTkMGbMGLZt28Ynn3zC5s2b+dnPfkbfvn3x8/Nj+vTp7N+/n8cff5zU1FSCg4MZMWIEr7/+OjExMbz66qv07t2bwN/+loceeojXX3+duLg4RowYwbhx4/jVr37FypUru5xz7rnnTlqyZMmgP/3pT/z2t78lICCALVu2cPfdd5N5+bVqoQ2oWR9vY8TYbDaGDh3KJ598Qnx8fI33Q1P2RURERBrG6UNZTPrZHD4Y0YPfLF/N4bMFTLzrN2xY9R4OP397I72P3d5lB7b+fdNx+HhZlPmH0K1Pb25/4w3+94IL2LlzJ/n5+ZSUlJCbm8uXx45x9MsvOVvtbL1y5syZw3PPPYcxJoPPWLdunbHb7ea6664zL7/8ssnOzja289Pcy8rKTF5ennE4HObQoUPmoYceMoGBgaZnz55m4cKFprS01CxcuND06dPH3HrrrcblcpkFCxaYTp06mUGDBpnDhw+bnJwcs3fvXvPRRx+Z2267zfTu3dt069bNtG7d2iQmJpq2bduarl27mp49e5rU1FTTs2dPExkZaWJjY01SUpJJSUnpsuyrH374YXPOOefUWJcuXYzD4ahQngkTJpjRo0eb0aNHm4suusgkJyeXP77U399/aYcOHcz+/fvN2bNnK7x/4cKFpnXr1uamm24yOTk5XZRp0RdfmMlDhpjB3bubs884w4wcObK8rJ06dTLbt28vv+QdDoeZN2+eadKkibn55ptNXl5el/t6+PBhs2zZMnOxxXS02UxKTJ25/LIh5qoJD5vdu3ebjIwMs3fvXrNv3z6zf/9+c/DgQfPll1+aI0eOmOPHj5vs7GyTn59vioqKjMPhqHT//v+9a2JjY82ECRNMcnKyGTZsmCktLa1QjqSkJHP27NlqlbWgsNDM+s1vzIwZM8y3LrvMZB04YNJTkk1Rq1ZmX1SUsSYmm0urOO6HDBli0tLSTElJibn//vtNXFyc6devn3nsscdM165dTXx8vPnXv/7VZb1s3rzZ3HvvvaZ79+4mJCTEpKSkmPbt25uxY8ea9957r9bqfedOnWbGjBmmVatWJjAw0FxfVGSysrLMjh07zN7MTHP61ClTWlpqvv/975vIyEgTFBRkkpOTTWJiohk8eLBZsmSJcTqd5qOPPjI9e/Y0c+fONaNGjTIrVqyoUEfZ2dnm/vvvN23atDHdunWrcK3cdttt1ap7Pz+/0zfddJNJSEgwc+bMMZmZmWbTpk3mgQceMHFxcWbEiBHmrrvuMs2bNzfJycnm7Lx53d7PurB161YzZMgQc+edd3psOz+Mx8+ppKQk8+mnn5qDBw+agoICj+2LiIiIiHTt+19904z+yY1m/JhbzRf33m1GPvG4mT5njhk786cmJjrGPP7446Zjx44mKirKREdHm7CwMBMSEmIOHz7s6WLXqc6dO5v333+/3r835V/6p6+vr0lOTjYDBgww119/vfnZz35mfvjDH5pbb73VTJgwwQwaNMgMGDDAjBo1ykyYMMGMHj3aXHPNNWb69OnmH//4hzl+/Hj5dCu70ymcMd7cGcQYY/Ly8sz+/fvN0qVLzY9//GPTpk0b07x5c9OhQwfTo0cP06tXL9OhQwfTpk2bbn1HcHCwGT16tCkqKrpgO5YtW9Zltmd8fLy55pprzHXXXWeGDh1qrB2TjM3Ly+zYscMUfN0vYM6cOWbq1KldBtK2bt1qPvjgAzNmzBgzcODADtdgnOndu7cZNmxYhVXXu3XrZioLbGZkZJjFixebiRMnmm7duilQXAtOP/10M27cODN58mTz05/+1Nx2223mRz/6kfnWt75VR3sTWuE6H9izp3n33XdNXl6eufLKK81TTz1lRo0aZYYOHWpGjBhhRowYYa6++mozbtw4c8MNN5hbb73V3HbbbeYnP/mJueOOO7p13jQUp9Np/vCHP5guXbqYioNpwyqMhzXN6rbCmmZ1k22Zlp2ZF154YbccI4MHD/bY7wnK4GEAAAAASUVORK5CYII=';

       // Read the original PNGs instead of embedding compressed base64 data.
       // The old inline payloads can be corrupted when copied or transformed.
       const assetsDir = path.join(__dirname, '..', 'assets');
       const logoLeft = fs.readFileSync(path.join(assetsDir, 'image1.png'));
       const logoRight = fs.readFileSync(path.join(assetsDir, 'image2.png'));
       const footerBar = fs.readFileSync(path.join(assetsDir, 'image3.png'));

       const BLACK = '#000000';
       const HEADER_BLUE = '#67B1CA';
       const GOLD = '#FFC000';
      const YELLOW = '#FFE599';
      const ML = 50;
      const PW = doc.page.width - ML * 2;

      const anio = new Date().getFullYear();
      const fechaActual = new Date();
      const dias = calcularDias(permiso.fecha_inicio, permiso.fecha_fin);
      const fechaInicio = fmtDate(permiso.fecha_inicio);
      const fechaFin = permiso.fecha_fin ? fmtDate(permiso.fecha_fin) : fechaInicio;

      // Draw a table cell at fixed (x,y). Saves/restores doc position to avoid side-effects.
      function cell(x: number, y: number, w: number, h: number, text: string, opts: {
        bg?: string; bold?: boolean; size?: number; color?: string; align?: string;
      } = {}) {
        const s = opts.size || 10;
        const c = opts.color || BLACK;
        const f = opts.bold ? BOLD : FONT;
         if (opts.bg) {
           doc.rect(x, y, w, h).fill(opts.bg);
         }
         doc.strokeColor(BLACK);
         doc.lineWidth(0.5);
         doc.rect(x, y, w, h).stroke();
        doc.font(f).fontSize(s).fillColor(c);
        const px = doc.x, py = doc.y;
        if (opts.align === 'center') {
          doc.text(text, x, y + 2, { align: 'center', width: w });
        } else {
          doc.text(text, x + 3, y + 2, { width: w - 6 });
        }
        doc.x = px; doc.y = py;
      }

      // Draw a row of cells at current doc.y, then advance doc.y by rowH.
      function row(rowH: number, cells: Array<{
        x: number; w: number; text: string;
        bg?: string; bold?: boolean; size?: number; align?: string;
      }>) {
        const y0 = doc.y;
        cells.forEach(c => {
          cell(c.x, y0, c.w, rowH, c.text, {
            bg: c.bg, bold: c.bold, size: c.size, align: c.align,
          });
        });
        doc.y = y0 + rowH;
      }

      // === HEADER (logos + school name, matching formato.docx) ===
      const headerY = 12;
      const logoLeftW = 86;
      const logoLeftH = 55;
      const logoRightW = 38;
      const logoRightH = 37;
      try { doc.image(logoLeft, ML, headerY, { width: logoLeftW, height: logoLeftH }); } catch (_) {}
      try { doc.image(logoRight, doc.page.width - ML - logoRightW, headerY, { width: logoRightW, height: logoRightH }); } catch (_) {}
       // The header text sits beside the logos, vertically centered with them.
       const textY = headerY + 8;
      doc.font(BOLD).fontSize(11).text('ESCUELA BLANCA ESTELA PRAT', ML, textY, { align: 'center', width: PW });
      doc.moveDown(0.1);
      doc.font(BOLD).fontSize(11).text('DIRECCIÓN DE ADMINISTRACIÓN DE EDUCACIÓN MUNICIPAL', ML, doc.y, { align: 'center', width: PW });
      doc.moveDown(0.1);
      doc.font(BOLD).fontSize(11).text('HUALPÉN', ML, doc.y, { align: 'center', width: PW });
        doc.y = headerY + logoLeftH + 6;
        doc.moveDown(0.25);
         doc.lineWidth(1);
         doc.strokeColor(HEADER_BLUE);
         doc.moveTo(ML, doc.y).lineTo(ML + PW, doc.y).stroke();
       doc.moveDown(0.35);

       // === TITLE ===
      doc.font(BOLD).fontSize(18).fillColor(BLACK).text('SOLICITUD DE PERMISO ADMINISTRATIVO', ML, doc.y, { align: 'center', width: PW });
      doc.moveDown(0.3);
       doc.font(BOLD).fontSize(11).text('Escuela Blanca Estela Prat Carvajal', ML, doc.y, { align: 'center', width: PW });
       doc.moveDown(0.5);

       // === N° + DATE ===
       const numberDateY = doc.y;
       doc.font(BOLD).fontSize(11).text(`N°_____/${anio}`, ML, numberDateY, { align: 'center', width: PW });
       doc.font(FONT).fontSize(11).text(`Hualpén, ${formatearFechaLetras(fechaActual)}`, ML, numberDateY, { align: 'right', width: PW });
       doc.moveDown(0.4);

      // === RESOLUCIÓN EXENTA FLOATING TABLE (right-aligned, narrow, 2 columns) ===
      const resW = 165;
      const resX = doc.page.width - ML - resW;
      row(24, [
        { x: resX, w: 115, text: 'RESOLUCIÓN EXENTA PERMISO N°', bold: false, size: 10, align: 'center' },
        { x: resX + 115, w: resW - 115, text: '', size: 9 },
      ]);
      doc.y += 4;

      // === DATA TABLE (3 columns matching formato.docx) ===
      const colW = PW / 3;
      const rH = 20;

      const cols = (i: number) => ML + i * colW;

      row(rH, [
        { x: cols(0), w: colW, text: 'NOMBRES', bg: GOLD, bold: true, size: 9 },
        { x: cols(1), w: colW, text: 'APELLIDO PATERNO', bg: GOLD, bold: true, size: 9 },
        { x: cols(2), w: colW, text: 'APELLIDO MATERNO', bg: GOLD, bold: true, size: 9 },
      ]);
      row(rH, [
        { x: cols(0), w: colW, text: usuario.nombres || '', size: 9 },
        { x: cols(1), w: colW, text: usuario.apellido_paterno || '', size: 9 },
        { x: cols(2), w: colW, text: usuario.apellido_materno || '', size: 9 },
      ]);
      row(rH, [
        { x: cols(0), w: colW, text: 'R.U.N', bg: GOLD, bold: true, size: 9 },
        { x: cols(1), w: colW, text: 'TÍTULO O ESPECIALIDAD', bg: GOLD, bold: true, size: 9 },
        { x: cols(2), w: colW, text: 'CARGO', bg: GOLD, bold: true, size: 9 },
      ]);
      row(rH, [
        { x: cols(0), w: colW, text: `${usuario.rut || ''}-${usuario.dv || ''}`, size: 9 },
        { x: cols(1), w: colW, text: usuario.titulo || '', size: 9 },
        { x: cols(2), w: colW, text: usuario.cargo || '', size: 9 },
      ]);
      row(rH, [
        { x: cols(0), w: colW, text: 'HORAS QUE DESEMPEÑA', bg: GOLD, bold: true, size: 9 },
        { x: cols(1), w: colW, text: '', size: 9 },
        { x: cols(2), w: colW, text: '', size: 9 },
      ]);
      doc.y += 10;

      // === LEGAL REFERENCE ===
      doc.font(BOLD).fontSize(10).text(
        'SOLICITA SE LE CONCEDA PERMISO ADMINISTRATIVO: artículo 40 de la ley 19.070, Dto. 453/91 educa art/129; ' +
        'artículo 129 del decreto N° 453, de 1991, del Ministerio de Educación, para los profesionales de la educación, ' +
        'y a su vez artículo 4° de la Ley 19.464, establecido en la ley N° 18.883 para asistentes de la educación.',
        ML, doc.y, { align: 'justify', width: PW }
      );
      doc.moveDown(0.6);

      // === MOTIVO + POR TABLE (6-column grid matching formato.docx) ===
      const mpRowH = 24;
      const g0 = 105;
      const g1 = 51;
      const g2 = 95;
      const g3 = 82;
      const g4 = 41;
      const g5 = PW - g0 - g1 - g2 - g3 - g4;

      // Row 0: Motivo (gold) + value spanning cols 1-5
      row(mpRowH, [
        { x: ML, w: g0, text: 'Motivo', bg: GOLD, bold: true, size: 11 },
        { x: ML + g0, w: PW - g0, text: permiso.motivo || '', size: 11 },
      ]);
      // Row 1: Por + day count + text + start date + text + end date
      row(mpRowH, [
        { x: ML, w: g0, text: 'Por', bg: GOLD, bold: true, size: 11 },
        { x: ML + g0, w: g1, text: String(dias), bold: true, size: 11, align: 'center' },
        { x: ML + g0 + g1, w: g2, text: `${dias === 1 ? 'día' : 'días'}, a contar desde el`, size: 11 },
        { x: ML + g0 + g1 + g2, w: g3, text: fechaInicio, bold: true, size: 11, align: 'center' },
        { x: ML + g0 + g1 + g2 + g3, w: g4, text: 'hasta el', size: 11 },
        { x: ML + g0 + g1 + g2 + g3 + g4, w: g5, text: fechaFin, bold: true, size: 11, align: 'center' },
      ]);
      doc.y += 6;

      // "Solicito los días..." text
      doc.font(FONT).fontSize(10).text(
        'Solicito los días de permiso que se indican, anteriormente CON/SIN goce de remuneraciones.',
        ML, doc.y, { width: PW }
      );
      doc.moveDown(0.6);

      // === RESUMEN PERMISOS LEGALES ===
      doc.font(BOLD).fontSize(11).text('RESUMEN PERMISOS LEGALES', ML, doc.y, { width: PW });
      doc.moveDown(0.3);

      const sRowH = 22;
      // Row 1: 4 cells spanning full PW
      row(sRowH, [
        { x: ML, w: 170, text: 'Total, días solicitados', bg: YELLOW, bold: false, size: 10 },
        { x: ML + 170, w: 80, text: String(dias), bold: true, size: 11, align: 'center' },
        { x: ML + 170 + 80, w: 190, text: 'Total, días autorizados', bg: YELLOW, bold: false, size: 10 },
        { x: ML + 170 + 80 + 190, w: PW - 170 - 80 - 190, text: '', bold: false, size: 11, align: 'center' },
      ]);
      const prevY = doc.y;
      doc.font(FONT).fontSize(7).fillColor(BLACK).text(
        '(completar quien autoriza)', ML + 170 + 80 + 5, doc.y - sRowH + 14
      );
      doc.y = prevY;
      // Row 2: label + 6 number cells filling the same width
      const numStartX = ML + 170;
      const numTotalW = PW - 170;
      const numCellW = numTotalW / 6;
      row(sRowH, [
        { x: ML, w: 170, text: 'Total, días autorizados a la fecha', bg: YELLOW, bold: false, size: 10 },
        { x: numStartX + 0 * numCellW, w: numCellW, text: '1', bold: false, size: 11, align: 'center' },
        { x: numStartX + 1 * numCellW, w: numCellW, text: '2', bold: false, size: 11, align: 'center' },
        { x: numStartX + 2 * numCellW, w: numCellW, text: '3', bold: false, size: 11, align: 'center' },
        { x: numStartX + 3 * numCellW, w: numCellW, text: '4', bold: false, size: 11, align: 'center' },
        { x: numStartX + 4 * numCellW, w: numCellW, text: '5', bold: false, size: 11, align: 'center' },
        { x: numStartX + 5 * numCellW, w: numCellW, text: '6', bold: false, size: 11, align: 'center' },
      ]);
      doc.y += 4;

      // === SIGNATURES TABLE ===
      const sigColW = PW / 2;
      row(40, [
        { x: ML, w: sigColW, text: '', size: 9 },
        { x: ML + sigColW, w: sigColW, text: '', size: 9 },
      ]);
      row(36, [
        { x: ML, w: sigColW, text: 'Firma de Funcionario', bg: GOLD, bold: true, size: 9 },
        { x: ML + sigColW, w: sigColW, text: 'Aracely Nova Garrido\nFirma/Timbre Directora(s)', bg: GOLD, bold: true, size: 9 },
      ]);
      doc.y += 4;

      // === VISTOS ===
       doc.font(BOLD).fontSize(10).text('VISTOS:', ML, doc.y, { continued: true });
       doc.font(FONT).fontSize(9).text(
        'El D.F.L. N°1-3063 de 1980 del Ministerio del Interior, Artículo 40° D.F.L. N°1 de 1996 del Ministerio de Educación, ' +
        'Estatuto de los Profesionales de la Educación, lo estipulado en el Contrato Individual de Trabajo (personal no docente), ' +
        'lo dispuesto en las Leyes 18.883, 19.465, Ley 18.695, Orgánica Constitucional de Municipalidades y sus modificaciones ' +
        'posteriores, y las facultades que me confiere la designación como directora del Establecimiento.',
        ML, doc.y, { align: 'justify', width: PW }
      );
      doc.moveDown(0.4);
       doc.font(FONT).fontSize(10).text('R E S U E L V O   QUE,', ML, doc.y, { width: PW });
      doc.moveDown(0.2);
      doc.font(FONT).fontSize(10).text(
        `Autorícese la presente solicitud de permiso desde ${fechaInicio} hasta ${fechaFin} año ${anio}, ` +
        `por ${dias} ${dias === 1 ? 'día' : 'días'}, CON/SIN goce de remuneraciones.`,
        ML, doc.y, { width: PW }
      );
      doc.moveDown(0.6);

      // === OBSERVATION ===
      doc.font(BOLD).fontSize(10).text('OBSERVACIÓN IMPORTANTE:', ML, doc.y, { width: PW });
      doc.moveDown(0.15);
      doc.font(FONT).fontSize(10).text('1.  Este formulario se debe llenar en duplicado.', ML, doc.y, { width: PW });
      doc.moveDown(0.1);
      doc.font(FONT).fontSize(10).text(
        '2.  Ningún funcionario puede abandonar el servicio, si no ha sido autorizado formalmente para hacer uso del permiso solicitado.',
        ML, doc.y, { width: PW }
      );

      // === FOOTER (full-width bar image, matching formato.docx) ===
      try {
        doc.image(footerBar, 0, doc.page.height - 50, { width: doc.page.width, height: 51 });
      } catch (_) {}

      doc.end();
    });
  },
};
