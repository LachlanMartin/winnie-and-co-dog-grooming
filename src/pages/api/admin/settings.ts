import type { APIRoute } from 'astro';
import { setSetting } from '../../../lib/settings';

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const businessName = String(form.get('business_name') ?? '').trim();
  const abn = String(form.get('abn') ?? '').trim();
  const bankDetails = String(form.get('bank_details') ?? '').trim();
  const invoicePrefix = String(form.get('invoice_prefix') ?? '').trim();

  if (businessName) await setSetting('business_name', businessName);
  await setSetting('abn', abn);
  await setSetting('bank_details', bankDetails);
  if (invoicePrefix) await setSetting('invoice_prefix', invoicePrefix);

  return redirect('/admin?tab=settings');
};
