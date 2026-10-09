/**
 * Seed script.
 *   - ALWAYS creates/updates the single admin account (the admin site has no signup).
 *   - If SEED_DEMO=true, also creates demo users and datasets in every state so the
 *     portals are not empty on first run. Safe to run repeatedly (idempotent).
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db.js';
import { storage } from '../src/storage/index.js';

const ROUNDS = 12;

async function upsertUser({ name, email, password, role }) {
  const passwordHash = await bcrypt.hash(password, ROUNDS);
  return prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { name, passwordHash, role, status: 'ACTIVE' },
    create: { name, email: email.toLowerCase(), passwordHash, role },
  });
}

function csv(rows) {
  return Buffer.from(rows.map((r) => r.join(',')).join('\n') + '\n');
}

async function createDemoDataset(owner, spec) {
  const exists = await prisma.dataset.findFirst({ where: { ownerId: owner.id, title: spec.title } });
  if (exists) return exists;
  const key = await storage.saveBuffer(spec.content, spec.fileName);
  return prisma.dataset.create({
    data: {
      title: spec.title,
      description: spec.description,
      category: spec.category,
      tags: spec.tags,
      status: spec.status,
      visibility: spec.visibility,
      rejectionReason: spec.rejectionReason ?? null,
      reviewedAt: spec.status === 'PENDING' ? null : new Date(),
      downloadCount: spec.downloadCount ?? 0,
      fileName: spec.fileName,
      filePath: key,
      fileSize: spec.content.length,
      fileType: spec.fileName.split('.').pop(),
      ownerId: owner.id,
    },
  });
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  await upsertUser({
    name: process.env.ADMIN_NAME || 'Platform Admin',
    email: adminEmail,
    password: adminPassword,
    role: 'ADMIN',
  });
  console.log(`Admin ready: ${adminEmail}`);

  if (process.env.SEED_DEMO !== 'true') return;

  const demoPassword = 'Demo@12345';
  const alice = await upsertUser({ name: 'Alice Johnson', email: 'alice@example.com', password: demoPassword, role: 'USER' });
  const bob = await upsertUser({ name: 'Bob Martinez', email: 'bob@example.com', password: demoPassword, role: 'USER' });
  await upsertUser({ name: 'Carol Nguyen', email: 'carol@example.com', password: demoPassword, role: 'USER' });

  const temps = await createDemoDataset(alice, {
    title: 'Global City Temperatures 2020',
    description: 'Average monthly temperatures (Celsius) for a sample of major cities, collected from public weather stations.',
    category: 'Climate',
    tags: ['weather', 'temperature', 'cities'],
    status: 'APPROVED',
    visibility: 'PUBLIC',
    downloadCount: 12,
    fileName: 'city_temperatures_2020.csv',
    content: csv([
      ['city', 'country', 'jan', 'apr', 'jul', 'oct'],
      ['Oslo', 'Norway', -4.3, 5.1, 17.2, 6.4],
      ['Cairo', 'Egypt', 14.1, 22.8, 29.5, 25.0],
      ['Sydney', 'Australia', 23.0, 19.7, 12.1, 18.4],
      ['Hyderabad', 'India', 23.1, 31.4, 26.5, 26.0],
    ]),
  });

  const churn = await createDemoDataset(alice, {
    title: 'Customer Churn Sample (restricted)',
    description: 'Anonymised telecom customer records with a churn flag. Access is granted case by case for research use.',
    category: 'Business',
    tags: ['churn', 'customers', 'telecom'],
    status: 'APPROVED',
    visibility: 'PRIVATE',
    downloadCount: 3,
    fileName: 'customer_churn_sample.csv',
    content: csv([
      ['customer_id', 'tenure_months', 'monthly_charge', 'churned'],
      ['C-1001', 12, 49.9, 'no'],
      ['C-1002', 3, 79.0, 'yes'],
      ['C-1003', 48, 39.5, 'no'],
      ['C-1004', 7, 64.2, 'yes'],
    ]),
  });

  await createDemoDataset(alice, {
    title: 'Weather Sensor Readings (raw)',
    description: 'Raw readings from a rooftop sensor array. Waiting for admin review.',
    category: 'Climate',
    tags: ['sensor', 'raw'],
    status: 'PENDING',
    visibility: 'PUBLIC',
    fileName: 'sensor_readings.txt',
    content: Buffer.from('2024-01-01T00:00Z temp=11.2 hum=64\n2024-01-01T01:00Z temp=10.8 hum=66\n'),
  });

  await createDemoDataset(bob, {
    title: 'Open Movie Ratings',
    description: 'A small collection of movie ratings by anonymous reviewers, suitable for recommendation-system demos.',
    category: 'Entertainment',
    tags: ['movies', 'ratings', 'recommendation'],
    status: 'APPROVED',
    visibility: 'PUBLIC',
    downloadCount: 27,
    fileName: 'movie_ratings.csv',
    content: csv([
      ['user_id', 'movie', 'rating'],
      [1, 'Inception', 5],
      [1, 'Arrival', 4],
      [2, 'Inception', 4],
      [2, 'Up', 3],
    ]),
  });

  await createDemoDataset(bob, {
    title: 'Retail Transactions Q1',
    description: 'Point-of-sale transactions for Q1 across three stores. Private until partners are vetted.',
    category: 'Business',
    tags: ['retail', 'transactions'],
    status: 'PENDING',
    visibility: 'PRIVATE',
    fileName: 'retail_q1.json',
    content: Buffer.from(JSON.stringify([{ store: 'A', total: 120.5 }, { store: 'B', total: 88.0 }], null, 2)),
  });

  await createDemoDataset(bob, {
    title: 'Scraped Product Prices',
    description: 'Prices scraped from various e-commerce websites with no source attribution.',
    category: 'Business',
    tags: ['prices', 'scraped'],
    status: 'REJECTED',
    visibility: 'PUBLIC',
    rejectionReason: 'Data was scraped without a clear license. Please add the source and license and resubmit.',
    fileName: 'prices.csv',
    content: csv([['item', 'price'], ['Phone', 299], ['Laptop', 799]]),
  });

  // Bob has asked Alice for access to her private dataset, so her "Requests Received" page has content.
  const already = await prisma.accessRequest.findFirst({ where: { datasetId: churn.id, requesterId: bob.id } });
  if (!already) {
    await prisma.accessRequest.create({
      data: { datasetId: churn.id, requesterId: bob.id, message: 'Hi Alice, I would like to use this for a university churn-prediction project.' },
    });
    await prisma.notification.create({
      data: {
        userId: alice.id,
        type: 'ACCESS_REQUEST_RECEIVED',
        title: 'New access request',
        message: `${bob.name} requested access to "${churn.title}".`,
        link: '/requests/received',
      },
    });
  }
  void temps;

  console.log('Demo data ready. Demo users (password Demo@12345): alice@example.com, bob@example.com, carol@example.com');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
