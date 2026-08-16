import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../lib/db';
import { bookings, invoiceItems, invoices, services } from '../../../../../db/schema';
import { getSetting } from '../../../../lib/settings';
import { recalcInvoiceTotals, loadInvoiceByToken } from '../../../../lib/invoice';
import { dollarsToCents } from '../../../../lib/money';
import { emailInvoiceSent } from '../../../../lib/email';

export const POST: APIRoute = async ({ request, redirect, params }) => {
  const id = Number(params.id);
  const form = await request.formData();
  const action = String(form.get('action') ?? '');

  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!inv) return redirect('/admin');

  const back = `/admin/invoices/${id}`;

  const removeItemId = Number(form.get('remove'));
  if (removeItemId) {
    await db.delete(invoiceItems).where(eq(invoiceItems.id, removeItemId));
    await recalcInvoiceTotals(id);
    return redirect(back);
  }

  if (action === 'add') {
    await db.insert(invoiceItems).values({ invoiceId: id, description: '', quantity: 1, unitPriceCents: 0, sortOrder: 99 });
    return redirect(back);
  }

  // save (shared by plain save + send)
  const descs = form.getAll('desc');
  const qtys = form.getAll('qty');
  const prices = form.getAll('price');
  const itemIds = form.getAll('item_id');
  for (let i = 0; i < itemIds.length; i++) {
    const itemId = Number(itemIds[i]);
    await db
      .update(invoiceItems)
      .set({
        description: String(descs[i] ?? '').trim(),
        quantity: Math.max(1, Number(qtys[i]) || 1),
        unitPriceCents: dollarsToCents(String(prices[i] ?? '0')),
      })
      .where(eq(invoiceItems.id, itemId));
  }
  await recalcInvoiceTotals(id);

  const dueDate = String(form.get('due_date') ?? '').trim();
  const notes = String(form.get('notes') ?? '').trim();
  await db.update(invoices).set({ dueDate: dueDate || null, notes }).where(eq(invoices.id, id));

  if (action === 'send' && inv.status !== 'paid') {
    await db
      .update(invoices)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(invoices.id, id));
    const data = await loadInvoiceByToken(inv.token);
    if (data?.booking && data.service && data.items.length) {
      const bankDetails = (await getSetting('bank_details')) ?? '';
      await emailInvoiceSent({ ...data.booking, service: data.service }, { ...inv, status: 'sent' as const }, data.items, bankDetails);
    }
    return redirect('/admin?tab=invoices');
  }

  if (action === 'paid') {
    await db.update(invoices).set({ status: 'paid', paidAt: new Date() }).where(eq(invoices.id, id));
    return redirect('/admin?tab=invoices');
  }

  if (action === 'void') {
    await db.update(invoices).set({ status: 'void' }).where(eq(invoices.id, id));
    return redirect('/admin?tab=invoices');
  }

  return redirect(back);
};
