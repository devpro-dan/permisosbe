import nodemailer from 'nodemailer';
import { systemConfigRepository } from '../repositories/systemConfig.repository';

function fmtDate(v: string | undefined | null): string {
  if (!v) return '-';
  const [y, m, d] = v.split('T')[0].split('-');
  if (!y || !m || !d) return v;
  return `${d}/${m}/${y}`;
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

function getEmailTemplate(title: string, content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;">
        <div style="background: #2563eb; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Sistema de Permisos Administrativos</h1>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #1e293b; margin-top: 0;">${title}</h2>
          ${content}
        </div>
        <div style="background: #f8fafc; padding: 15px; text-align: center; color: #64748b; font-size: 12px;">
          <p>Este es un mensaje automático del Sistema de Permisos Administrativos.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export const emailService = {
  async sendPermisoNotification(email: string, tipo: string, data: any) {
    const transport = await getTransporter();
    if (!transport) {
      console.log('SMTP no configurado, correo no enviado');
      return;
    }

    const smtpFrom = await systemConfigRepository.findByClave('smtp_from');
    const from = smtpFrom?.valor || 'noreply@permisosbe.com';

    let subject = '';
    let title = '';
    let content = '';

    switch (tipo) {
      case 'solicitado':
        subject = 'Permiso Administrativo Solicitado';
        title = 'Permiso Administrativo Solicitado';
        content = `
          <p>Se ha solicitado un nuevo permiso administrativo.</p>
          <p><strong>Motivo:</strong> ${data.motivo}</p>
          <p><strong>Fecha Inicio:</strong> ${fmtDate(data.fecha_inicio)}</p>
          <p><strong>Estado:</strong> En Revisión</p>
        `;
        break;
      case 'aprobado':
        subject = 'Permiso Administrativo Aprobado';
        title = '¡Permiso Administrativo Aprobado!';
        content = `
          <p>Su permiso administrativo ha sido <strong style="color: #16a34a;">aprobado</strong>.</p>
          <p><strong>Motivo:</strong> ${data.motivo}</p>
          <p><strong>Fecha Inicio:</strong> ${fmtDate(data.fecha_inicio)}</p>
        `;
        break;
      case 'rechazado':
        subject = 'Permiso Administrativo Rechazado';
        title = 'Permiso Administrativo Rechazado';
        content = `
          <p>Su permiso administrativo ha sido <strong style="color: #dc2626;">rechazado</strong>.</p>
          <p><strong>Motivo del rechazo:</strong> ${data.motivo_rechazo}</p>
          <p><strong>Motivo original:</strong> ${data.motivo}</p>
        `;
        break;
    }

    try {
      await transport.sendMail({
        from: `"PermisosBE" <${from}>`,
        to: email,
        subject,
        html: getEmailTemplate(title, content),
      });
    } catch (err) {
      console.error('Error enviando correo:', err);
    }
  },
};
