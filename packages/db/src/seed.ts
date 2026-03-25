import { PrismaClient, KnowledgeCategory, AccessLevel } from '@prisma/client';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const prisma = new PrismaClient();

// AES-256-GCM encryption for seed secrets
// Using a fixed test key — 32 bytes = 64 hex chars
const SEED_VAULT_KEY = Buffer.from(
  'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  'hex',
);

function encryptSeedSecret(plaintext: string): {
  value: Buffer;
  iv: Buffer;
  authTag: Buffer;
} {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', SEED_VAULT_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return { value: encrypted, iv, authTag };
}

async function main(): Promise<void> {
  console.log('🌱 Starting seed...');

  // Clean up existing seed data
  await prisma.secretItem.deleteMany({});
  await prisma.knowledgeItem.deleteMany({});
  await prisma.property.deleteMany({});
  await prisma.organizationMember.deleteMany({});
  await prisma.organization.deleteMany({ where: { slug: 'pipo-house' } });
  await prisma.user.deleteMany({ where: { clerkId: 'dev-user' } });

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: 'Pipo House',
      slug: 'pipo-house',
      plan: 'TRIAL',
    },
  });
  console.log(`  ✓ Organization: ${org.name} (${org.id})`);

  // Create dev user
  const user = await prisma.user.create({
    data: {
      clerkId: 'dev-user',
      email: 'dev@pipo.house',
      name: 'Dev User',
    },
  });
  console.log(`  ✓ User: ${user.email} (${user.id})`);

  // Create org membership
  await prisma.organizationMember.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      role: 'OWNER',
      acceptedAt: new Date(),
    },
  });
  console.log(`  ✓ OrganizationMember: OWNER`);

  // Create property
  const property = await prisma.property.create({
    data: {
      organizationId: org.id,
      name: 'Pipo House Susukino',
      slug: 'apt-001',
      timezone: 'Asia/Tokyo',
      defaultLanguage: 'en',
      personalityMode: 'CONCIERGE',
      aiEnabled: true,
      webChatEnabled: true,
    },
  });
  console.log(`  ✓ Property: ${property.name} (${property.id})`);

  // Seed knowledge items
  const knowledgeItems = [
    {
      category: 'CHECK_IN' as KnowledgeCategory,
      title: 'Check-In Instructions',
      content: `Welcome to Pipo House Susukino! Check-in time is 3:00 PM JST.

To check in:
1. You will receive an access code via email 24 hours before arrival.
2. Enter the building using the main entrance keypad (code sent separately).
3. Take the elevator to floor 8, apartment 801.
4. Use your personal door code to unlock the apartment.
5. A welcome guide is on the kitchen counter with all essential information.

Early check-in (before 3 PM) may be available upon request — please contact us at least 48 hours in advance.
Late check-in after 11 PM: use the same door code, no staff required.`,
    },
    {
      category: 'HOUSE_RULES' as KnowledgeCategory,
      title: 'House Rules',
      content: `To ensure a pleasant stay for all guests, please observe the following rules:

• No smoking inside the apartment. Violators will be charged a ¥50,000 cleaning fee.
• No parties or events without prior written consent.
• Quiet hours: 10 PM – 8 AM. Please be mindful of neighbours.
• Maximum occupancy: 4 guests (as registered at booking).
• No pets allowed unless pre-approved in writing.
• Keep the apartment clean and respect furnishings.
• Separate your waste: burnable, non-burnable, plastic, and glass. Collection schedule is posted in the kitchen.
• Do not remove towels, pillows, or other household items from the apartment.`,
    },
    {
      category: 'WIFI' as KnowledgeCategory,
      title: 'WiFi Information',
      content: `High-speed WiFi is available throughout the apartment.

Network name (SSID): PipoHouse_801
Speed: 1 Gbps fibre optic

The WiFi password is provided in your booking confirmation email. You can also ask Pipo (our AI concierge) to remind you of the hint for locating it.

If you experience connectivity issues:
1. Try restarting your device first.
2. Restart the router (white box near the TV) by unplugging it for 10 seconds.
3. If still unresolved, contact us via the chat.`,
    },
    {
      category: 'PARKING' as KnowledgeCategory,
      title: 'Parking Information',
      content: `Pipo House Susukino does not have dedicated on-site parking.

Nearby parking options:
• Mitsui Repark Susukino (2 min walk) — ¥300/hour, 24h
• Times Parking South 4 West 4 (4 min walk) — ¥250/hour
• NPC24H Susukino Parking (5 min walk) — ¥280/hour, max ¥2,400/day

For longer stays, we recommend the NPC24H option which offers monthly passes.

Public transport: The Susukino subway station (Namboku and Toho lines) is a 3-minute walk. A day pass costs ¥830 and covers all Sapporo subway lines.`,
    },
    {
      category: 'FAQ' as KnowledgeCategory,
      title: 'Frequently Asked Questions',
      content: `Q: What time is check-out?
A: Check-out is at 11:00 AM JST. Late check-out until 1 PM may be available for an extra fee — ask us in advance.

Q: Is there a washing machine?
A: Yes, a washer/dryer combo is in the bathroom. Detergent is provided under the sink.

Q: How do I control the air conditioning?
A: Remote controls are on the bedside tables. The AC also acts as a heater in winter — press the HEAT button on the remote.

Q: Can I get extra towels or toiletries?
A: Starter supplies (2 towel sets, shampoo, conditioner, body wash, toilet paper) are provided. For extras, contact us and we will arrange delivery.

Q: Is there a curfew?
A: No curfew. The building and apartment are accessible 24/7 with your codes.

Q: Where is the nearest convenience store?
A: A 7-Eleven is 1 minute walk (same block, south side). FamilyMart is 3 minutes walk.

Q: Are short-term food deliveries allowed?
A: Yes. Give the delivery driver the building address and buzz in from the intercom panel by the main entrance.`,
    },
  ];

  for (const item of knowledgeItems) {
    const created = await prisma.knowledgeItem.create({
      data: {
        propertyId: property.id,
        title: item.title,
        content: item.content,
        category: item.category,
        accessLevel: AccessLevel.AI_READABLE,
        isPublished: true,
        publishedAt: new Date(),
        language: 'en',
      },
    });
    console.log(`  ✓ Knowledge item: ${created.title} [${created.category}]`);
  }

  // Seed secrets (encrypted)
  const doorCode = encryptSeedSecret('1234*'); // test code
  const doorCodeItem = await prisma.secretItem.create({
    data: {
      propertyId: property.id,
      key: 'door_code',
      value: doorCode.value,
      iv: doorCode.iv,
      authTag: doorCode.authTag,
      guestHint: 'Check your booking confirmation email for the door code.',
    },
  });
  console.log(`  ✓ Secret: ${doorCodeItem.key} (encrypted)`);

  const wifiPassword = encryptSeedSecret('PipoSusukino2024!'); // test password
  const wifiItem = await prisma.secretItem.create({
    data: {
      propertyId: property.id,
      key: 'wifi_password',
      value: wifiPassword.value,
      iv: wifiPassword.iv,
      authTag: wifiPassword.authTag,
      guestHint:
        'Check your booking confirmation email for the WiFi password.',
    },
  });
  console.log(`  ✓ Secret: ${wifiItem.key} (encrypted)`);

  console.log('\n✅ Seed complete!');
  console.log(`   Organization ID : ${org.id}`);
  console.log(`   User ID         : ${user.id}`);
  console.log(`   Property ID     : ${property.id}`);
  console.log(`   Knowledge items : ${knowledgeItems.length}`);
  console.log(`   Secrets         : 2`);
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
