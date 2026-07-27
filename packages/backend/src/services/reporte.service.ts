import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

export const reporteService = {
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
};
