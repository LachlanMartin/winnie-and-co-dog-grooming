import { Resend } from 'resend';
import { money } from './money';
import { dayLabel, slotLabel } from './tz';
import type { Booking, Invoice, InvoiceItem, Service } from '../../db/schema';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? 'Winnie & Co <onboarding@resend.dev>';
const OWNER = process.env.OWNER_EMAIL ?? '';
const SITE = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.warn(`[email] skipped (no RESEND_API_KEY): ${subject} -> ${to}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (e) {
    console.error(`[email] failed to send "${subject}" to ${to}:`, e);
  }
}

const shell = (body: string) => `
  <div style="font-family:Nunito,Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;line-height:1.5">
    <div style="padding:20px 0 10px;text-align:center;border-bottom:2px solid #9be9fd">
      <img src="${SITE}/images/logo.png" alt="Winnie &amp; Co Dog Grooming" width="150" style="display:block;margin:0 auto;max-width:150px;height:auto" />
      <img src="${SITE}/images/under-logo.png" alt="Mobile dog grooming in Berwick &amp; surrounds" style="display:block;width:100%;max-width:520px;height:auto;margin:12px auto 0" />
    </div>
    <div style="padding:24px 0">${body}</div>
    <div style="padding:16px 0;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">
      Winnie &amp; Co Dog Grooming · Mobile grooming in Berwick &amp; surrounding suburbs · 0408 700 265
    </div>
  </div>`;

export type BookingView = Booking & { service: Service };

function bookingLines(b: BookingView): string {
  return [
    `<b>Service:</b> ${b.service.name}${b.size ? ` (${b.size})` : ''}`,
    `<b>When:</b> ${dayLabel(b.slotStart)} at ${slotLabel(b.slotStart).split(',')[1]?.trim() ?? ''}`,
    `<b>Dog:</b> ${b.dogName}${b.dogBreed ? ` (${b.dogBreed})` : ''}`,
    `<b>Address:</b> ${b.address}${b.suburb ? `, ${b.suburb}` : ''}`,
  ].join('<br>');
}

export async function emailRequestReceived(b: BookingView) {
  await send(
    b.customerEmail,
    'Booking request received — Winnie & Co Dog Grooming',
    shell(
      `<p>Hi ${b.customerName},</p>
       <p>Thanks for booking with Winnie &amp; Co! Your request has been received and is awaiting confirmation.</p>
       <p>${bookingLines(b)}</p>
       <p>You'll receive a confirmation email once your appointment is approved. If you need to change or cancel, just reply to this email or call 0408 700 265.</p>`,
    ),
  );
}

export async function emailRequestToOwner(b: BookingView) {
  await send(
    OWNER,
    `New booking request: ${b.dogName} — ${b.service.name}`,
    shell(
      `<p><b>New booking request awaiting approval:</b></p>
       <p>${bookingLines(b)}</p>
       <p><b>Customer:</b> ${b.customerName} · ${b.customerEmail} · ${b.customerPhone}</p>
       ${b.notes ? `<p><b>Notes:</b> ${b.notes}</p>` : ''}
       <p><a href="${SITE}/admin">Open admin to approve or decline</a></p>`,
    ),
  );
}

export async function emailBookingConfirmed(b: BookingView) {
  await send(
    b.customerEmail,
    'Booking confirmed — Winnie & Co Dog Grooming',
    shell(
      `<p>Hi ${b.customerName},</p>
       <p>Great news — your appointment is <b>confirmed</b>!</p>
       <p>${bookingLines(b)}</p>
       <p>See you then! 🐾</p>`,
    ),
  );
}

export async function emailBookingDeclined(b: BookingView) {
  await send(
    b.customerEmail,
    `Booking declined — Winnie & Co Dog Grooming`,
    shell(
      `<p>Hi ${b.customerName},</p>
       <p>Unfortunately we're unable to accommodate your requested appointment:</p>
       <p>${bookingLines(b)}</p>
       <p>Please get in touch on 0408 700 265 or at alisha@winnieandcodoggrooming.com.au to arrange an alternative time.</p>`,
    ),
  );
}

export async function emailLoginAlert(ip: string) {
  await send(
    OWNER,
    'Alert: repeated failed admin logins — Winnie & Co',
    shell(
      `<p><b>Repeated failed admin login attempts detected.</b></p>
       <p>More than 5 failed attempts in 15 minutes from IP <code>${ip}</code>.</p>
       <p>Logins are temporarily blocked for that address. If this wasn't you, someone may be trying to brute-force the admin panel.</p>`,
    ),
  );
}

export async function emailInvoiceSent(
  b: BookingView,
  inv: Invoice,
  items: InvoiceItem[],
  bankDetails: string,
) {
  const rows = items
    .map((i) => `<tr><td>${i.description}</td><td align="right">${i.quantity}</td><td align="right">${money(i.unitPriceCents)}</td></tr>`)
    .join('');
  await send(
    b.customerEmail,
    `Invoice ${inv.number} from Winnie & Co Dog Grooming`,
    shell(
      `<p>Hi ${b.customerName},</p>
       <p>Your invoice for your ${b.service.name} appointment is ready:</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr style="border-bottom:1px solid #e5e7eb"><th align="left">Description</th><th align="right">Qty</th><th align="right">Amount</th></tr>
         ${rows}
         <tr style="font-weight:700"><td>Total</td><td></td><td align="right">${money(inv.totalCents)}</td></tr>
       </table>
       ${inv.notes ? `<p><b>Notes:</b> ${inv.notes}</p>` : ''}
       ${bankDetails ? `<p><b>Payment details:</b><br>${bankDetails.replace(/\n/g, '<br>')}</p>` : ''}
       <p><a href="${SITE}/invoice/${inv.token}" style="display:inline-block;background:#0789c5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">View invoice</a></p>
       <p style="font-size:13px;color:#6b7280">Please pay by ${inv.dueDate ?? 'your appointment date'}. Thank you!</p>`,
    ),
  );
}
