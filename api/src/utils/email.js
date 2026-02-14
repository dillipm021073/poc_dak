const nodemailer = require('nodemailer');

// Create transporter - uses SMTP env vars, falls back to console logging for dev
const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

const FROM_ADDRESS = process.env.SMTP_FROM || 'D.A.K <noreply@dak.com>';

/**
 * Send an email. Falls back to console logging if SMTP is not configured.
 */
async function sendMail({ to, subject, html, icalEvent }) {
  const mailOptions = {
    from: FROM_ADDRESS,
    to,
    subject,
    html
  };

  // Attach ICS as both alternative (for auto-update) and attachment (for manual import)
  if (icalEvent) {
    mailOptions.alternatives = [{
      contentType: 'text/calendar; charset="UTF-8"; method=CANCEL',
      content: icalEvent
    }];
    mailOptions.attachments = [{
      filename: 'cancellation.ics',
      content: icalEvent,
      contentType: 'text/calendar'
    }];
  }

  if (transporter) {
    await transporter.sendMail(mailOptions);
  } else {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
    if (icalEvent) console.log(`[EMAIL] ICS cancellation attached`);
  }
}

/**
 * Generate a METHOD:CANCEL ICS for an event. Uses the same UID so calendar
 * apps will match it to the original event and remove/cancel it.
 */
function generateCancellationIcs(event) {
  const formatDate = (date) => new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const escapeIcs = (str) => (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//D.A.K//Community Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:CANCEL',
    'BEGIN:VEVENT',
    `UID:${event.id}@dak.com`,
    `DTSTART:${formatDate(event.starts_at)}`,
    `DTEND:${formatDate(event.ends_at || event.starts_at)}`,
    `SUMMARY:CANCELLED: ${escapeIcs(event.title)} (${escapeIcs(event.community_name)})`,
    `DESCRIPTION:This event has been cancelled by ${escapeIcs(event.community_name)}.`,
    `ORGANIZER;CN=${escapeIcs(event.community_name)}:mailto:noreply@dak.com`,
    'STATUS:CANCELLED',
    `SEQUENCE:1`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Send event cancellation email to a user with ICS attachment.
 */
async function sendEventCancellation({ to, event }) {
  const icalEvent = generateCancellationIcs(event);

  const startDate = new Date(event.starts_at).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const startTime = new Date(event.starts_at).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit'
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 16px 20px; border-radius: 4px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 4px; color: #991b1b; font-size: 18px;">Event Cancelled</h2>
        <p style="margin: 0; color: #7f1d1d; font-size: 14px;">The following event has been cancelled by the organizer.</p>
      </div>
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 12px; color: #111827;">${event.title}</h3>
        <p style="margin: 4px 0; color: #6b7280; font-size: 14px;">
          <strong>Community:</strong> ${event.community_name}
        </p>
        <p style="margin: 4px 0; color: #6b7280; font-size: 14px;">
          <strong>Was scheduled for:</strong> ${startDate} at ${startTime}
        </p>
        ${event.location ? `<p style="margin: 4px 0; color: #6b7280; font-size: 14px;"><strong>Location:</strong> ${event.location}</p>` : ''}
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
        If you added this event to your calendar, it should be automatically removed.
        If not, you can import the attached .ics file to update your calendar.
      </p>
    </div>
  `;

  await sendMail({
    to,
    subject: `Event Cancelled: ${event.title} - ${event.community_name}`,
    html,
    icalEvent
  });
}

module.exports = { sendMail, sendEventCancellation, generateCancellationIcs };
