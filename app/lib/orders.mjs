// The order database and the refund policy as code, so the copilot's tools answer from
// facts rather than from what the model remembers.
import { readFileSync } from 'node:fs';

const read = (path) => JSON.parse(readFileSync(new URL(`../../data/${path}`, import.meta.url), 'utf8'));
const ORDERS = read('orders.json');
const CUSTOMERS = read('customers.json');

/** Today, frozen by ACME_CLOCK in test environments so fixture orders keep their age. */
export const today = () => new Date(process.env.ACME_CLOCK ?? Date.now());

const daysBetween = (from, to) => Math.floor((to - new Date(from)) / 86_400_000);
const businessDaysPast = (promisedBy, now) => {
  let days = 0;
  const cursor = new Date(promisedBy);
  while (cursor < now) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6 && cursor <= now) days += 1;
  }
  return days;
};

export const lookupOrder = (orderId) => {
  const order = ORDERS.find((candidate) => candidate.id === String(orderId).replace(/\D/g, ''));
  if (!order) return { found: false, orderId: String(orderId) };
  const customer = CUSTOMERS.find((candidate) => candidate.id === order.customerId);
  return {
    found: true,
    orderId: order.id,
    status: order.status,
    placedAt: order.placedAt,
    deliveredAt: order.deliveredAt,
    promisedBy: order.promisedBy ?? null,
    lastScanAt: order.lastScanAt ?? null,
    carrier: order.carrier,
    items: order.items.map(({ name, price, finalSale, giftCard }) => ({ name, price, finalSale, giftCard: Boolean(giftCard) })),
    total: order.total,
    customer: customer ? { firstName: customer.name.split(' ')[0], language: customer.language, country: customer.country } : null,
  };
};

export const checkRefundPolicy = (orderId, reason = 'change_of_mind') => {
  const order = ORDERS.find((candidate) => candidate.id === String(orderId).replace(/\D/g, ''));
  if (!order) return { orderId: String(orderId), eligible: false, rule: 'unknown_order', explanation: 'No order with that number.' };
  const now = today();
  if (order.items.every((item) => item.finalSale)) {
    return { orderId: order.id, eligible: false, rule: 5, explanation: 'Final sale items and gift cards are never refunded.' };
  }
  if (reason === 'damaged') {
    const days = order.deliveredAt ? daysBetween(order.deliveredAt, now) : null;
    return days !== null && days <= 14
      ? { orderId: order.id, eligible: true, rule: 2, explanation: 'Damaged on arrival within 14 days: full refund or free replacement, no return needed, with a photo.' }
      : { orderId: order.id, eligible: false, rule: 2, explanation: 'Damage must be reported with a photo within 14 days of delivery.' };
  }
  if (reason === 'late' || reason === 'lost') {
    if (order.deliveredAt) return { orderId: order.id, eligible: false, rule: 3, explanation: 'The parcel was delivered.' };
    const sinceScan = order.lastScanAt ? daysBetween(order.lastScanAt, now) : 0;
    if (sinceScan >= 14) return { orderId: order.id, eligible: true, rule: 4, explanation: 'No tracking movement for 14 days: the parcel is lost; refund in full or ship a replacement.' };
    const late = order.promisedBy ? businessDaysPast(order.promisedBy, now) : 0;
    return late > 5
      ? { orderId: order.id, eligible: false, voucher: { amount: 10, currency: 'EUR' }, rule: 3, explanation: 'More than 5 business days late: offer a 10 EUR voucher; a late parcel alone is not a refund.' }
      : { orderId: order.id, eligible: false, rule: 3, explanation: 'Not yet more than 5 business days late.' };
  }
  const days = order.deliveredAt ? daysBetween(order.deliveredAt, now) : null;
  return days !== null && days <= 30
    ? { orderId: order.id, eligible: true, rule: 1, explanation: 'Within 30 days of delivery: refund for unused items returned; the customer pays return shipping.' }
    : { orderId: order.id, eligible: false, rule: 1, explanation: 'More than 30 days since delivery.' };
};
