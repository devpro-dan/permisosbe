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

function calcularDias(inicio: string, fin: string | undefined | null, tipoJornada?: string): number {
  const d1 = new Date(inicio + 'T12:00:00');
  const d2 = new Date((fin || inicio) + 'T12:00:00');
  let count = 0; const cur = new Date(d1); while (cur <= d2) { const day = cur.getDay(); if (day !== 0 && day !== 6) count++; cur.setDate(cur.getDate() + 1); } if (count === 0) count = 1;
  if (tipoJornada === 'media') return Math.max(0.5, count - 0.5);
  return count;
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

async function createTransporter() {
  const smtpHost = await systemConfigRepository.findByClave('smtp_host');
  const smtpPort = await systemConfigRepository.findByClave('smtp_port');
  const smtpUser = await systemConfigRepository.findByClave('smtp_user');
  const smtpPass = await systemConfigRepository.findByClave('smtp_pass');

  if (!smtpHost?.valor || !smtpPort?.valor || !smtpUser?.valor || !smtpPass?.valor) {
    return null;
  }

  const host = smtpHost.valor.trim();
  if (!host) return null;

  const transport = nodemailer.createTransport({
    host,
    port: parseInt(smtpPort.valor, 10),
    secure: parseInt(smtpPort.valor, 10) === 465,
    auth: { user: smtpUser.valor.trim(), pass: smtpPass.valor },
    tls: { rejectUnauthorized: false },
  });

  try {
    await transport.verify();
  } catch (err: any) {
    const msg = err.message || '';
    if (msg.includes('queryA') || msg.includes('ENOTFOUND') || msg.includes('ESOCKET')) {
      throw new Error(
        `No se pudo conectar al servidor SMTP (${host}:${smtpPort.valor}). ` +
        'Verifica que el host y puerto sean correctos y que el servidor sea accesible.'
      );
    }
    if (msg.includes('auth') || msg.includes('login') || msg.includes('535')) {
      throw new Error('Error de autenticación SMTP. Verifica el usuario y contraseña.');
    }
    throw new Error(`Error de conexión SMTP: ${msg}`);
  }

  return transport;
}

async function getTransporter() {
  if (transporter) return transporter;
  transporter = await createTransporter();
  return transporter;
}

function getEmailTemplate(title: string, body: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
        <div style="background:#2596be;padding:20px;text-align:center;">
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
  async sendTestEmail(email: string) {
    const testTransporter = await createTransporter();
    if (!testTransporter) {
      throw new Error('SMTP no configurado. Completa todos los campos SMTP y guarda la configuración.');
    }

    const smtpFrom = await systemConfigRepository.findByClave('smtp_from');
    const from = smtpFrom?.valor || 'noreply@permisosbe.com';

    await testTransporter.sendMail({
      from: `"PermisosBE" <${from}>`,
      to: email,
      subject: 'Prueba de configuración SMTP - PermisosBE',
      html: getEmailTemplate('Prueba de correo exitosa', `
        <p style="color:#374151;font-size:15px;line-height:1.6;">Este correo confirma que la configuración SMTP funciona correctamente.</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;">Puedes utilizar el servicio de correo del sistema.</p>
      `),
    });
  },

  async sendPermisoNotification(email: string, tipo: string, data: any, userName?: string, disponibilidad?: { available: number; max: number }, categoria: 'administrativo' | 'matrimonio' = 'administrativo') {
    const transport = await getTransporter();
    if (!transport) {
      console.log('SMTP no configurado, correo no enviado');
      return;
    }

    const smtpFrom = await systemConfigRepository.findByClave('smtp_from');
    const from = smtpFrom?.valor || 'noreply@permisosbe.com';

    const saludo = userName ? `Hola <strong>${userName}</strong>,` : 'Hola,';
    const isMatrimonioNotif = categoria === 'matrimonio';
    const dias = isMatrimonioNotif ? 5 : calcularDias(data.fecha_inicio, data.fecha_fin, data.tipo_jornada);
    const diaLabel = `${dias} ${dias === 1 ? 'día' : 'días'}`;

    let resumenHtml = '';
    if (disponibilidad) {
      resumenHtml = `
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;background:#f8fafc;border-radius:8px;">
          <tr>
            <td style="padding:12px;text-align:center;border-right:1px solid #e5e7eb;">
              <div style="font-size:24px;font-weight:700;color:#2596be;">${diaLabel}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px;">Solicitados</div>
            </td>
            <td style="padding:12px;text-align:center;border-right:1px solid #e5e7eb;">
              <div style="font-size:24px;font-weight:700;color:#1e293b;">${disponibilidad.max}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px;">Permitidos por año</div>
            </td>
            <td style="padding:12px;text-align:center;">
              <div style="font-size:24px;font-weight:700;color:${disponibilidad.available > 0 ? '#16a34a' : '#dc2626'};">${disponibilidad.available}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px;">Disponibles</div>
            </td>
          </tr>
        </table>`;
    }

    let subject = '';
    let title = '';
    let body = '';

    const label = isMatrimonioNotif ? 'Permiso por Matrimonio' : 'Permiso Administrativo';
    switch (tipo) {
      case 'solicitado': {
        subject = `${label} Solicitado`;
        title = 'Solicitud Recibida';
        body = `
          <p style="color:#374151;font-size:15px;line-height:1.6;">${saludo}</p>
          <p style="color:#374151;font-size:15px;line-height:1.6;">Hemos recibido tu solicitud de ${label.toLowerCase()}. A continuación, el resumen:</p>
          ${resumenHtml}
          ${detailTable(data)}
          <div style="text-align:center;margin:20px 0 10px;">${estadoBadge(data.estado)}</div>
          <p style="color:#6b7280;font-size:14px;line-height:1.5;text-align:center;">Su solicitud está pendiente de revisión por su jefatura. Recibirás un correo cuando sea aprobada o rechazada.</p>
        `;
        break;
      }
      case 'aprobado': {
        subject = `${label} Aprobado`;
        title = '¡Permiso Aprobado!';
        body = `
          <p style="color:#374151;font-size:15px;line-height:1.6;">${saludo}</p>
          <p style="color:#374151;font-size:15px;line-height:1.6;">Tu ${label.toLowerCase()} ha sido <strong style="color:#16a34a;">aprobado</strong>.</p>
          ${resumenHtml}
          ${detailTable(data)}
          <div style="text-align:center;margin:20px 0 10px;">${estadoBadge(data.estado)}</div>
        `;
        break;
      }
      case 'rechazado': {
        subject = `${label} Rechazado`;
        title = 'Permiso Rechazado';
        body = `
          <p style="color:#374151;font-size:15px;line-height:1.6;">${saludo}</p>
          <p style="color:#374151;font-size:15px;line-height:1.6;">Lamentamos informarte que tu ${label.toLowerCase()} ha sido <strong style="color:#dc2626;">rechazado</strong>.</p>
          ${resumenHtml}
          ${detailTable(data)}
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
      console.error('Error enviando correo de notificación:', err);
      transporter = null;
    }
  },

  async sendJefaturaNotificacion(permisos: any[], usuarios: any[], tipo: 'administrativo' | 'matrimonio' = 'administrativo') {
    const notifConfig = await systemConfigRepository.findByClave('jefatura_notificacion_email');
    const dest = notifConfig?.valor?.trim();
    if (!dest) {
      console.log('Jefatura email no configurado, notificación omitida');
      return;
    }
    const ccConfig = await systemConfigRepository.findByClave('jefatura_notificacion_cc_email');
    const cc = ccConfig?.valor?.trim() || undefined;
    const transport = await getTransporter();
    if (!transport) {
      console.log('SMTP no configurado, correo a jefatura no enviado');
      return;
    }
    const smtpFrom = await systemConfigRepository.findByClave('smtp_from');
    const from = smtpFrom?.valor || 'noreply@permisosbe.com';
    const isMatrimonio = tipo === 'matrimonio';
    const titulo = isMatrimonio ? 'Permiso por Matrimonio' : 'Permiso Administrativo';
    const subject = `Nuevo ${titulo} pendiente de revisión${permisos.length > 1 ? ` (${permisos.length})` : ''}`;
    const title = `Nuevo ${titulo} pendiente de revisión`;

    const userTableRows = (user: any) => [
      ['Nombre', `${user.nombres || ''} ${user.apellido_paterno || ''} ${user.apellido_materno || ''}`.trim()],
      ['RUT', `${user.rut || ''}-${user.dv || ''}`],
      ['Cargo', user.cargo || '-'],
      ['Email', user.email || '-'],
    ];

    const permisoRows = (p: any) => {
      const filas: [string, string][] = [
        ['Fecha Inicio', fmtDate(p.fecha_inicio)],
        ['Fecha Fin', fmtDate(p.fecha_fin)],
        ['Días', isMatrimonio ? '5 días' : `${calcularDias(p.fecha_inicio, p.fecha_fin, p.tipo_jornada)} días`],
        ['Jornada', isMatrimonio ? 'Completa' : jornadaLabel(p.tipo_jornada)],
        ['Motivo', p.motivo || '-'],
        ['Estado', 'Pendiente de revisión'],
      ];
      return filas;
    };

    const tablesHtml = permisos.map((p, idx) => {
      const u = usuarios[idx] || usuarios[0] || {};
      const userRows = userTableRows(u);
      const permRows = permisoRows(p);
      return `
        <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:16px 0;">
          <div style="background:#f8fafc;padding:10px 14px;font-weight:700;color:#1e293b;font-size:13px;">Solicitud #${idx + 1} — ${u.nombres || ''} ${u.apellido_paterno || ''}</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr><td colspan="2" style="background:#eff6ff;padding:8px 12px;font-weight:700;color:#1e40af;font-size:12px;">DATOS DEL FUNCIONARIO</td></tr>
            ${userRows.map(([k, v]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;width:130px;font-weight:600;">${k}</td><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;color:#1f2937;">${v}</td></tr>`).join('')}
            <tr><td colspan="2" style="background:#fef3c7;padding:8px 12px;font-weight:700;color:#92400e;font-size:12px;">DETALLE DEL PERMISO</td></tr>
            ${permRows.map(([k, v]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;width:130px;font-weight:600;">${k}</td><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;color:#1f2937;">${v}</td></tr>`).join('')}
          </table>
        </div>
      `;
    }).join('');

    const body = `
      <p style="color:#374151;font-size:15px;line-height:1.6;">Se ha registrado una nueva solicitud de <strong>${titulo.toLowerCase()}</strong> que requiere revisión.</p>
      ${tablesHtml}
      <p style="color:#6b7280;font-size:13px;margin-top:16px;">Ingresa al sistema en <strong>Gestión de Permisos</strong> para aprobar o rechazar la solicitud.</p>
      <div style="text-align:center;margin:20px 0;"><span style="display:inline-block;padding:6px 14px;background:#fef3c7;color:#92400e;border-radius:999px;font-size:13px;font-weight:600;">Pendiente de revisión</span></div>
    `;

    try {
      await transport.sendMail({
        from: `"PermisosBE" <${from}>`,
        to: dest,
        cc: cc || undefined,
        subject,
        html: getEmailTemplate(title, body),
      });
    } catch (err) {
      console.error('Error enviando notificación a jefatura:', err);
      transporter = null;
    }
  },

  async sendResetPasswordEmail(email: string, userName: string, resetLink: string) {
    const transport = await getTransporter();
    if (!transport) {
      throw new Error('SMTP no configurado');
    }

    const smtpFrom = await systemConfigRepository.findByClave('smtp_from');
    const from = smtpFrom?.valor || 'noreply@permisosbe.com';

    await transport.sendMail({
      from: `"PermisosBE" <${from}>`,
      to: email,
      subject: 'Restablecimiento de Contraseña',
      html: getEmailTemplate('Restablecer Contraseña', `
        <p style="color:#374151;font-size:15px;line-height:1.6;">Hola <strong>${userName}</strong>,</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;">Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente botón para crear una nueva contraseña:</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#2596be;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">Restablecer Contraseña</a>
        </div>
        <p style="color:#6b7280;font-size:13px;line-height:1.5;">Este enlace expirará en 1 hora. Si no solicitaste este cambio, ignora este mensaje.</p>
      `),
    });
  },
};
