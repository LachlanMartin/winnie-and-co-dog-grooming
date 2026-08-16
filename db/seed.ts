import 'dotenv/config';
import { db } from '../src/lib/db';
import { addons, services, workingHours, settings } from './schema';

await db.insert(services).values([
  {
    name: 'Puppy Introduction',
    slug: 'puppy-introduction',
    hasSizes: false,
    priceFlat: 7000,
    durationFlat: 60,
    sortOrder: 1,
    description:
      'A gentle introduction to grooming designed for puppies under 6 months, building confidence with a gentle bath (Hydra Luxury Care Sensitive & Puppy Shampoo), blow dry, gentle brush out, nail trim and hygiene trim if required. A full body clip is not included — some puppies need a few sessions before a full groom.',
  },
  {
    name: 'Full Groom',
    slug: 'full-groom',
    hasSizes: true,
    priceS: 9000, priceM: 11000, priceL: 13000, priceXl: 15000,
    durationS: 120, durationM: 150, durationL: 180, durationXl: 210,
    sortOrder: 2,
    description:
      'The complete grooming experience: bath with premium shampoo and conditioner, blow dry, brush out, nail trim, ear clean, paw pad tidy, sanitary trim and full body clip/style to your choice. Pricing varies with breed, coat condition, size and temperament; severely matted coats or extra time may incur additional fees.',
  },
  {
    name: 'Tidy Groom',
    slug: 'tidy-groom',
    hasSizes: true,
    priceS: 8000, priceM: 9000, priceL: 11000, priceXl: 12000,
    durationS: 90, durationM: 120, durationL: 150, durationXl: 180,
    sortOrder: 3,
    description:
      'Keeps your dog clean and tidy between full grooms: bath, blow dry, sanitary trim, paw pad tidy, face and eye tidy (if required), nail trim, ear cleaning and brush out. No full body clip or styling — book a Full Groom if your dog needs an all-over haircut.',
  },
  {
    name: 'Short Coat Bath',
    slug: 'short-coat-bath',
    hasSizes: true,
    priceS: 7500, priceM: 9000, priceL: 10500, priceXl: 12000,
    durationS: 60, durationM: 75, durationL: 90, durationXl: 120,
    sortOrder: 4,
    description:
      'A maintenance service for short-coated breeds: bath, blow dry, full brush out, nail trim and ear/face cleaning. If your dog has sensitive skin, Hydra Luxury Care Sensitive & Puppy Shampoo is available for an additional $10.',
  },
  {
    name: 'Long Coat Deshedding',
    slug: 'long-coat-deshedding',
    hasSizes: true,
    priceS: 8000, priceM: 11000, priceL: 13000, priceXl: 15000,
    durationS: 120, durationM: 150, durationL: 180, durationXl: 210,
    sortOrder: 5,
    description:
      'A specialised treatment for long double-coated breeds: bath with de-shedding shampoo and conditioner, blow dry to release loose coat, thorough brush out and nail trim. Reduces loose hair by removing excess undercoat — it will not completely stop natural shedding.',
  },
]);

await db.insert(addons).values([
  { name: 'Nail Grinding', priceCents: 1500, sortOrder: 1 },
  { name: 'Ear Plucking', priceCents: 2000, sortOrder: 2 },
  { name: 'Flea Wash Treatment', priceCents: 1500, sortOrder: 3 },
  { name: 'Cologne Spray', priceCents: 1000, sortOrder: 4 },
]);

await db.insert(workingHours).values([
  { dayOfWeek: 0, openTime: '08:30', closeTime: '15:30' }, // Sunday
  { dayOfWeek: 1, openTime: '18:30', closeTime: '20:30' }, // Monday
  { dayOfWeek: 2, openTime: '18:30', closeTime: '20:30' }, // Tuesday
  { dayOfWeek: 3, openTime: '18:30', closeTime: '20:30' }, // Wednesday
  { dayOfWeek: 4, openTime: '18:30', closeTime: '20:30' }, // Thursday
  { dayOfWeek: 5, openTime: '18:30', closeTime: '20:30' }, // Friday
  { dayOfWeek: 6, openTime: '14:30', closeTime: '18:30' }, // Saturday (every week)
]);

await db.insert(settings).values([
  { key: 'biweekly_sat_anchor', value: '' },
  { key: 'business_name', value: 'Winnie & Co Dog Grooming' },
  { key: 'invoice_prefix', value: 'INV' },
  { key: 'invoice_counter', value: '0' },
  { key: 'abn', value: '' },
  { key: 'bank_details', value: '' },
]);

console.log('Seeded services, addons, working hours, settings.');
process.exit(0);
