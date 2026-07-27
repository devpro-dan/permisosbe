import nodemailer from 'nodemailer';
import { systemConfigRepository } from '../repositories/systemConfig.repository';

function fmtDate(v: string | undefined | null): string {
  if (!v) return '-';
  const [y, m, d] = v.split('T')[0].split('-');
  if (!y || !m || !d) return v;
  return `${d}/${m}/${y}`;
}

function jornadaLabel(v: string): string {
  return v === 'completa' ? 'Completa' : 'Media Jornada';
}

function calcularDias(inicio: string, fin: string | undefined | null): number {
  if (!fin || fin === inicio) return 1;
  const d1 = new Date(inicio + 'T12:00:00');
  const d2 = new Date(fin + 'T12:00:00');
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
}

function estadoBadge(estado: string): string {
  const styles: Record<string, string> = {
    en_revision: 'background: #fef3c7; color: #92400e;',
    aprobado: 'background: #dcfce7; color: #166534;',
    rechazado: 'background: #fee2e2; color: #991b1b;',
  };
  const labels: Record<string, string> = {
    en_revision: 'En Revisión',
    aprobado: 'Aprobado',
    rechazado: 'Rechazado',
  };
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:600;${styles[estado] || ''}">${labels[estado] || estado}</span>`;
}

function detailTable(data: any, extraRows?: [string, string][]): string {
  const rows: [string, string][] = [
    ['Fecha Inicio', fmtDate(data.fecha_inicio)],
    ['Fecha Fin', fmtDate(data.fecha_fin)],
    ['Jornada', jornadaLabel(data.tipo_jornada)],
    ['Motivo', data.motivo],
  ];
  if (extraRows) rows.push(...extraRows);
  if (data.motivo_rechazo) {
    rows.push(['Motivo de Rechazo', data.motivo_rechazo]);
  }
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;width:140px;vertical-align:top;font-weight:600;">${label}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#1f2937;">${value}</td>
        </tr>
      `).join('')}
    </table>`;
}

let transporter: nodemailer.Transporter | null = null;

async function getTransporter() {
  if (transporter) return transporter;

  const smtpHost = await systemConfigRepository.findByClave('smtp_host');
  const smtpPort = await systemConfigRepository.findByClave('smtp_port');
  const smtpUser = await systemConfigRepository.findByClave('smtp_user');
  const smtpPass = await systemConfigRepository.findByClave('smtp_pass');
  const smtpFrom = await systemConfigRepository.findByClave('smtp_from');

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpHost.valor || !smtpPort.valor || !smtpUser.valor || !smtpPass.valor) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost.valor,
    port: parseInt(smtpPort.valor, 10),
    secure: parseInt(smtpPort.valor, 10) === 465,
    auth: {
      user: smtpUser.valor,
      pass: smtpPass.valor,
    },
  });

  return transporter;
}

function getEmailTemplate(title: string, body: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
        <div style="background:#2563eb;padding:20px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">Sistema de Permisos Administrativos</h1>
        </div>
        <div style="padding:30px;">
          <h2 style="color:#1e293b;margin-top:0;font-size:18px;">${title}</h2>
          ${body}
        </div>
        <div style="background:#f8fafc;padding:15px;text-align:center;color:#64748b;font-size:12px;">
          <p style="margin:0;">Este es un mensaje automático del Sistema de Permisos Administrativos.</p>
          <p style="margin:4px 0 0;">No responda a este correo.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export const emailService = {
  async sendPermisoNotification(email: string, tipo: string, data: any, userName?: string, available?: number) {
    const transport = await getTransporter();
    if (!transport) {
      console.log('SMTP no configurado, correo no enviado');
      return;
    }

    const smtpFrom = await systemConfigRepository.findByClave('smtp_from');
    const from = smtpFrom?.valor || 'noreply@permisosbe.com';

    const saludo = userName ? `Hola <strong>${userName}</strong>,` : 'Hola,';
    let subject = '';
    let title = '';
    let body = '';

    switch (tipo) {
      case 'solicitado': {
        const dias = calcularDias(data.fecha_inicio, data.fecha_fin);
        const extras: [string, string][] = [
          ['Días Solicitados', `${dias} ${dias === 1 ? 'día' : 'días'}`],
        ];
        if (available !== undefined) {
          extras.push(['Permisos Restantes', `${available} de ${available + 1} este año`]);
        }
        subject = 'Permiso Administrativo Solicitado';
        title = 'Solicitud Recibida';
        body = `
          <p style="color:#374151;font-size:15px;line-height:1.6;">${saludo}</p>
          <p style="color:#374151;font-size:15px;line-height:1.6;">Hemos recibido tu solicitud de permiso administrativo. A continuación, los detalles:</p>
          ${detailTable(data, extras)}
          <div style="text-align:center;margin:20px 0 10px;">${estadoBadge(data.estado)}</div>
          <p style="color:#6b7280;font-size:14px;line-height:1.5;text-align:center;">Su solicitud está pendiente de revisión por su jefatura. Recibirás un correo cuando sea aprobada o rechazada.</p>
        `;
        break;
      }
      case 'aprobado': {
        const diasApr = calcularDias(data.fecha_inicio, data.fecha_fin);
        const extrasApr: [string, string][] = [
          ['Días Solicitados', `${diasApr} ${diasApr === 1 ? 'día' : 'días'}`],
        ];
        if (available !== undefined) {
          extrasApr.push(['Permisos Restantes', `${available} de ${available + 1} este año`]);
        }
        subject = 'Permiso Administrativo Aprobado';
        title = '¡Permiso Aprobado!';
        body = `
          <p style="color:#374151;font-size:15px;line-height:1.6;">${saludo}</p>
          <p style="color:#374151;font-size:15px;line-height:1.6;">Tu permiso administrativo ha sido <strong style="color:#16a34a;">aprobado</strong>.</p>
          ${detailTable(data, extrasApr)}
          <div style="text-align:center;margin:20px 0 10px;">${estadoBadge(data.estado)}</div>
        `;
        break;
      }
      case 'rechazado': {
        const diasRech = calcularDias(data.fecha_inicio, data.fecha_fin);
        const extrasRech: [string, string][] = [
          ['Días Solicitados', `${diasRech} ${diasRech === 1 ? 'día' : 'días'}`],
        ];
        if (available !== undefined) {
          extrasRech.push(['Permisos Restantes', `${available} de ${available + 1} este año`]);
        }
        subject = 'Permiso Administrativo Rechazado';
        title = 'Permiso Rechazado';
        body = `
          <p style="color:#374151;font-size:15px;line-height:1.6;">${saludo}</p>
          <p style="color:#374151;font-size:15px;line-height:1.6;">Lamentamos informarte que tu permiso administrativo ha sido <strong style="color:#dc2626;">rechazado</strong>.</p>
          ${detailTable(data, extrasRech)}
          <div style="text-align:center;margin:20px 0 10px;">${estadoBadge(data.estado)}</div>
        `;
        break;
      }
    }

    try {
      await transport.sendMail({
        from: `"PermisosBE" <${from}>`,
        to: email,
        subject,
        html: getEmailTemplate(title, body),
      });
    } catch (err) {
      console.error('Error enviando correo:', err);
    }
  },
};
