import { Handedness, MatchPhase, MatchStatus, PrismaClient, Role, TournamentFormat } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

interface ClubSeed {
  id: string;
  name: string;
  city: string;
  adminEmail: string;
  adminPassword: string;
  coachEmail: string;
  coachPassword: string;
  teams: { id: string; name: string; jerseyColor: string }[];
  players: PlayerSeed[];
}

interface PlayerSeed {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date
  heightCm: number;
  dominantHand: Handedness;
  position: string;
}

const CLUBS: ClubSeed[] = [
  {
    id: "club-dunav",
    name: "KK Dunav",
    city: "Beograd",
    adminEmail: "dunav.admin@3x3app.local",
    adminPassword: "Dunav123!",
    coachEmail: "dunav.coach@3x3app.local",
    coachPassword: "DunavCoach123!",
    teams: [
      { id: "team-dunav-seniori", name: "Dunav Seniori", jerseyColor: "Blue" },
      { id: "team-dunav-juniori", name: "Dunav Juniori", jerseyColor: "Navy" },
    ],
    players: [
      { id: "player-dunav-1", firstName: "Aleksandar", lastName: "Jovanovic", dateOfBirth: "2001-03-14", heightCm: 188, dominantHand: Handedness.RIGHT, position: "Guard" },
      { id: "player-dunav-2", firstName: "Milos", lastName: "Petrovic", dateOfBirth: "1999-07-22", heightCm: 196, dominantHand: Handedness.RIGHT, position: "Forward" },
      { id: "player-dunav-3", firstName: "Nemanja", lastName: "Ilic", dateOfBirth: "1997-11-05", heightCm: 203, dominantHand: Handedness.LEFT, position: "Center" },
      { id: "player-dunav-4", firstName: "Vukasin", lastName: "Pavlovic", dateOfBirth: "2002-01-30", heightCm: 183, dominantHand: Handedness.RIGHT, position: "Guard" },
      { id: "player-dunav-5", firstName: "Ognjen", lastName: "Ristic", dateOfBirth: "2000-09-18", heightCm: 192, dominantHand: Handedness.RIGHT, position: "Forward" },
    ],
  },
  {
    id: "club-sava",
    name: "KK Sava",
    city: "Novi Sad",
    adminEmail: "sava.admin@3x3app.local",
    adminPassword: "Sava123!",
    coachEmail: "sava.coach@3x3app.local",
    coachPassword: "SavaCoach123!",
    teams: [
      { id: "team-sava-seniori", name: "Sava Seniori", jerseyColor: "Green" },
      { id: "team-sava-juniori", name: "Sava Juniori", jerseyColor: "Olive" },
    ],
    players: [
      { id: "player-sava-1", firstName: "Filip", lastName: "Nikolic", dateOfBirth: "2000-05-12", heightCm: 186, dominantHand: Handedness.RIGHT, position: "Guard" },
      { id: "player-sava-2", firstName: "Dusan", lastName: "Simic", dateOfBirth: "1998-02-27", heightCm: 198, dominantHand: Handedness.LEFT, position: "Forward" },
      { id: "player-sava-3", firstName: "Bogdan", lastName: "Kovacevic", dateOfBirth: "1996-12-03", heightCm: 205, dominantHand: Handedness.RIGHT, position: "Center" },
      { id: "player-sava-4", firstName: "Marko", lastName: "Radovic", dateOfBirth: "2001-08-19", heightCm: 181, dominantHand: Handedness.RIGHT, position: "Guard" },
      { id: "player-sava-5", firstName: "Uros", lastName: "Milenkovic", dateOfBirth: "1999-04-25", heightCm: 194, dominantHand: Handedness.AMBIDEXTROUS, position: "Forward" },
    ],
  },
  {
    id: "club-morava",
    name: "KK Morava",
    city: "Nis",
    adminEmail: "morava.admin@3x3app.local",
    adminPassword: "Morava123!",
    coachEmail: "morava.coach@3x3app.local",
    coachPassword: "MoravaCoach123!",
    teams: [
      { id: "team-morava-seniori", name: "Morava Seniori", jerseyColor: "Red" },
      { id: "team-morava-juniori", name: "Morava Juniori", jerseyColor: "Maroon" },
    ],
    players: [
      { id: "player-morava-1", firstName: "Stefan", lastName: "Vasic", dateOfBirth: "2002-06-09", heightCm: 184, dominantHand: Handedness.RIGHT, position: "Guard" },
      { id: "player-morava-2", firstName: "Lazar", lastName: "Stankovic", dateOfBirth: "2000-10-14", heightCm: 193, dominantHand: Handedness.RIGHT, position: "Forward" },
      { id: "player-morava-3", firstName: "Andrija", lastName: "Maric", dateOfBirth: "1998-01-21", heightCm: 201, dominantHand: Handedness.LEFT, position: "Center" },
      { id: "player-morava-4", firstName: "Vladimir", lastName: "Zivkovic", dateOfBirth: "1999-09-07", heightCm: 187, dominantHand: Handedness.RIGHT, position: "Guard" },
      { id: "player-morava-5", firstName: "Petar", lastName: "Dimitrijevic", dateOfBirth: "2001-03-03", heightCm: 190, dominantHand: Handedness.RIGHT, position: "Forward" },
    ],
  },
  {
    id: "club-drina",
    name: "KK Drina",
    city: "Kragujevac",
    adminEmail: "drina.admin@3x3app.local",
    adminPassword: "Drina123!",
    coachEmail: "drina.coach@3x3app.local",
    coachPassword: "DrinaCoach123!",
    teams: [
      { id: "team-drina-seniori", name: "Drina Seniori", jerseyColor: "Black" },
      { id: "team-drina-juniori", name: "Drina Juniori", jerseyColor: "Gray" },
    ],
    players: [
      { id: "player-drina-1", firstName: "Nikola", lastName: "Todorovic", dateOfBirth: "2000-11-16", heightCm: 185, dominantHand: Handedness.RIGHT, position: "Guard" },
      { id: "player-drina-2", firstName: "Mihailo", lastName: "Jankovic", dateOfBirth: "1998-07-08", heightCm: 197, dominantHand: Handedness.RIGHT, position: "Forward" },
      { id: "player-drina-3", firstName: "Igor", lastName: "Popovic", dateOfBirth: "1997-05-29", heightCm: 204, dominantHand: Handedness.LEFT, position: "Center" },
      { id: "player-drina-4", firstName: "Bojan", lastName: "Antic", dateOfBirth: "2002-02-11", heightCm: 182, dominantHand: Handedness.RIGHT, position: "Guard" },
      { id: "player-drina-5", firstName: "Danilo", lastName: "Obradovic", dateOfBirth: "1999-12-24", heightCm: 191, dominantHand: Handedness.AMBIDEXTROUS, position: "Forward" },
    ],
  },
];

// Exactly two Scouts, seeded directly (not via the club-invite flow — a global, club-independent
// permission has no single inviting club to attach an Invite row to; see the Role enum's SCOUT
// comment and User.isScout for why this is a flag, not a ClubMembership role).
interface ScoutSeed {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

const SCOUTS: ScoutSeed[] = [
  { id: "scout-nikola", firstName: "Nikola", lastName: "Scout", email: "nikola.scout@3x3app.local", password: "NikolaScout123!" },
  { id: "scout-vukasin", firstName: "Vukasin", lastName: "Scout", email: "vukasin.scout@3x3app.local", password: "VukasinScout123!" },
];

const TOURNAMENT_ID = "tournament-regionalni-kup-2026";

// Scheduled, untagged matches — deliberately left with no video/tags/lock so the full workflow
// (Admin already created these; a Scout picks Tournament -> Match, adds video, tags, locks; a
// Coach then views the result) is something to actually exercise live, not something the seed
// pre-fakes. Full round-robin across all 4 clubs' senior teams (6 matchups), spread over a few
// scheduled dates like a real group stage.
const MATCHES = [
  { id: "match-dunav-vs-sava", homeTeamId: "team-dunav-seniori", awayTeamId: "team-sava-seniori", phase: MatchPhase.GROUP_STAGE, scheduledAt: "2026-05-16T10:00:00Z" },
  { id: "match-morava-vs-drina", homeTeamId: "team-morava-seniori", awayTeamId: "team-drina-seniori", phase: MatchPhase.GROUP_STAGE, scheduledAt: "2026-05-16T11:00:00Z" },
  { id: "match-dunav-vs-morava", homeTeamId: "team-dunav-seniori", awayTeamId: "team-morava-seniori", phase: MatchPhase.GROUP_STAGE, scheduledAt: "2026-05-16T14:00:00Z" },
  { id: "match-sava-vs-drina", homeTeamId: "team-sava-seniori", awayTeamId: "team-drina-seniori", phase: MatchPhase.GROUP_STAGE, scheduledAt: "2026-05-16T15:00:00Z" },
  { id: "match-dunav-vs-drina", homeTeamId: "team-dunav-seniori", awayTeamId: "team-drina-seniori", phase: MatchPhase.GROUP_STAGE, scheduledAt: "2026-05-17T10:00:00Z" },
  { id: "match-sava-vs-morava", homeTeamId: "team-sava-seniori", awayTeamId: "team-morava-seniori", phase: MatchPhase.GROUP_STAGE, scheduledAt: "2026-05-17T11:00:00Z" },
];

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

  for (const scoutSeed of SCOUTS) {
    const scout = await prisma.user.upsert({
      where: { email: scoutSeed.email },
      update: { isScout: true },
      create: {
        email: scoutSeed.email,
        passwordHash: await argon2.hash(scoutSeed.password),
        firstName: scoutSeed.firstName,
        lastName: scoutSeed.lastName,
        isScout: true,
      },
    });
    console.log(`Seeded scout: ${scout.email}`);
  }

  for (const clubSeed of CLUBS) {
    const club = await prisma.club.upsert({
      where: { id: clubSeed.id },
      update: { name: clubSeed.name, city: clubSeed.city },
      create: { id: clubSeed.id, name: clubSeed.name, city: clubSeed.city },
    });

    const admin = await prisma.user.upsert({
      where: { email: clubSeed.adminEmail },
      update: {},
      create: {
        email: clubSeed.adminEmail,
        passwordHash: await argon2.hash(clubSeed.adminPassword),
        firstName: clubSeed.name,
        lastName: "Admin",
      },
    });
    await prisma.clubMembership.upsert({
      where: { userId_clubId: { userId: admin.id, clubId: club.id } },
      update: { role: Role.CLUB_ADMIN },
      create: { userId: admin.id, clubId: club.id, role: Role.CLUB_ADMIN },
    });

    // A COACH per club — read-only under the new RBAC model (views stats/tags/clips, cannot
    // upload video, tag, lock, or manage tournaments/matches/teams/rosters/players).
    const coach = await prisma.user.upsert({
      where: { email: clubSeed.coachEmail },
      update: {},
      create: {
        email: clubSeed.coachEmail,
        passwordHash: await argon2.hash(clubSeed.coachPassword),
        firstName: clubSeed.name,
        lastName: "Coach",
      },
    });
    await prisma.clubMembership.upsert({
      where: { userId_clubId: { userId: coach.id, clubId: club.id } },
      update: { role: Role.COACH },
      create: { userId: coach.id, clubId: club.id, role: Role.COACH },
    });

    for (const teamSeed of clubSeed.teams) {
      await prisma.team.upsert({
        where: { id: teamSeed.id },
        update: { name: teamSeed.name, jerseyColor: teamSeed.jerseyColor },
        create: {
          id: teamSeed.id,
          clubId: club.id,
          name: teamSeed.name,
          jerseyColor: teamSeed.jerseyColor,
        },
      });
    }

    for (const playerSeed of clubSeed.players) {
      await prisma.player.upsert({
        where: { id: playerSeed.id },
        update: {
          firstName: playerSeed.firstName,
          lastName: playerSeed.lastName,
          dateOfBirth: new Date(playerSeed.dateOfBirth),
          heightCm: playerSeed.heightCm,
          dominantHand: playerSeed.dominantHand,
          position: playerSeed.position,
        },
        create: {
          id: playerSeed.id,
          firstName: playerSeed.firstName,
          lastName: playerSeed.lastName,
          dateOfBirth: new Date(playerSeed.dateOfBirth),
          heightCm: playerSeed.heightCm,
          dominantHand: playerSeed.dominantHand,
          position: playerSeed.position,
          homeClubId: club.id,
        },
      });
    }

    console.log(
      `Seeded club: ${club.name} (${club.city}) — admin ${admin.email}, coach ${coach.email}, ` +
        `${clubSeed.teams.length} teams, ${clubSeed.players.length} players`
    );
  }

  // One cross-club tournament (no single organizing club) so each club's first team already
  // has a real roster to work against out of the box.
  const tournament = await prisma.tournament.upsert({
    where: { id: TOURNAMENT_ID },
    update: {},
    create: {
      id: TOURNAMENT_ID,
      name: "Regionalni Kup 2026",
      location: "Beograd",
      startDate: new Date("2026-05-16"),
      format: TournamentFormat.GROUP_STAGE,
      ageCategory: "Senior",
      clubId: null,
    },
  });

  for (const clubSeed of CLUBS) {
    const seniorTeamId = clubSeed.teams[0].id;
    const roster = await prisma.roster.upsert({
      where: { teamId_tournamentId: { teamId: seniorTeamId, tournamentId: tournament.id } },
      update: {},
      create: { teamId: seniorTeamId, tournamentId: tournament.id },
    });
    for (const [index, playerSeed] of clubSeed.players.entries()) {
      await prisma.rosterPlayer.upsert({
        where: { rosterId_playerId: { rosterId: roster.id, playerId: playerSeed.id } },
        update: {},
        create: { rosterId: roster.id, playerId: playerSeed.id, jerseyNumber: index + 4 },
      });
    }
  }
  console.log(`Seeded tournament: ${tournament.name} with a roster for each club's senior team`);

  // Superadmin is the createdById here purely for the FK — match creation is Admin-only, and
  // the superadmin is the one seeding these as already-scheduled fixtures for a Scout to tag.
  for (const matchSeed of MATCHES) {
    await prisma.match.upsert({
      where: { id: matchSeed.id },
      update: { phase: matchSeed.phase, scheduledAt: new Date(matchSeed.scheduledAt) },
      create: {
        id: matchSeed.id,
        tournamentId: tournament.id,
        homeTeamId: matchSeed.homeTeamId,
        awayTeamId: matchSeed.awayTeamId,
        phase: matchSeed.phase,
        scheduledAt: new Date(matchSeed.scheduledAt),
        status: MatchStatus.SCHEDULED,
        createdById: superadmin.id,
      },
    });
  }
  console.log(`Seeded ${MATCHES.length} scheduled matches, ready for a Scout to add video and tag`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
