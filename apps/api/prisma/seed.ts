import { PrismaClient, TournamentFormat } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const superadminEmail = process.env.SEED_SUPERADMIN_EMAIL ?? "admin@3x3app.local";
  const superadminPassword = process.env.SEED_SUPERADMIN_PASSWORD ?? "ChangeMe123!";

  const superadmin = await prisma.user.upsert({
    where: { email: superadminEmail },
    update: {},
    create: {
      email: superadminEmail,
      passwordHash: await argon2.hash(superadminPassword),
      firstName: "Super",
      lastName: "Admin",
      isSuperadmin: true,
    },
  });
  console.log(`Seeded superadmin: ${superadmin.email}`);

  // Sample club/team/players for local dev/testing — safe to skip in prod seeding later.
  const club = await prisma.club.upsert({
    where: { id: "seed-club-1" },
    update: {},
    create: {
      id: "seed-club-1",
      name: "KK Primer",
      city: "Beograd",
    },
  });

  const coachEmail = "coach@3x3app.local";
  const coach = await prisma.user.upsert({
    where: { email: coachEmail },
    update: {},
    create: {
      email: coachEmail,
      passwordHash: await argon2.hash("ChangeMe123!"),
      firstName: "Coach",
      lastName: "Example",
    },
  });
  await prisma.clubMembership.upsert({
    where: { userId_clubId: { userId: coach.id, clubId: club.id } },
    update: {},
    create: { userId: coach.id, clubId: club.id, role: "COACH" },
  });
  console.log(`Seeded coach: ${coach.email} (club: ${club.name})`);

  const team = await prisma.team.upsert({
    where: { id: "seed-team-1" },
    update: {},
    create: {
      id: "seed-team-1",
      clubId: club.id,
      name: "U18 Boys",
      jerseyColor: "Red",
    },
  });

  const playerNames = [
    ["Marko", "Markovic"],
    ["Nikola", "Nikolic"],
    ["Stefan", "Stefanovic"],
    ["Luka", "Lukic"],
  ];
  for (const [firstName, lastName] of playerNames) {
    await prisma.player.upsert({
      where: { id: `seed-player-${firstName.toLowerCase()}` },
      update: {},
      create: {
        id: `seed-player-${firstName.toLowerCase()}`,
        firstName,
        lastName,
        homeClubId: club.id,
      },
    });
  }
  console.log(`Seeded team: ${team.name} with ${playerNames.length} players`);

  const tournament = await prisma.tournament.upsert({
    where: { id: "seed-tournament-1" },
    update: {},
    create: {
      id: "seed-tournament-1",
      name: "Prolecni Kup 2026",
      location: "Beograd",
      startDate: new Date("2026-04-18"),
      format: TournamentFormat.GROUP_STAGE,
      ageCategory: "U18",
      clubId: club.id,
    },
  });
  console.log(`Seeded tournament: ${tournament.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
