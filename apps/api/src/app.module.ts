import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { ClubsModule } from "./modules/clubs/clubs.module";
import { TeamsModule } from "./modules/teams/teams.module";
import { PlayersModule } from "./modules/players/players.module";
import { RostersModule } from "./modules/rosters/rosters.module";
import { TournamentsModule } from "./modules/tournaments/tournaments.module";
import { MatchesModule } from "./modules/matches/matches.module";
import { VideoModule } from "./modules/video/video.module";
import { TagsModule } from "./modules/tags/tags.module";
import { StatsModule } from "./modules/stats/stats.module";
import { DashboardsModule } from "./modules/dashboards/dashboards.module";
import { MailModule } from "./modules/mail/mail.module";
import { QueueModule } from "./common/queue/queue.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { ClubScopeGuard } from "./common/guards/club-scope.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { validateEnv } from "./config/env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    QueueModule,
    AuthModule,
    UsersModule,
    MailModule,
    ClubsModule,
    TeamsModule,
    PlayersModule,
    RostersModule,
    TournamentsModule,
    MatchesModule,
    VideoModule,
    TagsModule,
    StatsModule,
    DashboardsModule,
  ],
  providers: [
    // Order matters: JwtAuthGuard populates request.user, ClubScopeGuard uses it to resolve
    // request.clubContext, RolesGuard uses both. NestJS runs providers registered this way
    // in array order for a given request.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ClubScopeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
