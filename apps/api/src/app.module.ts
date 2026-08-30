import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
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
    AuthModule,
    UsersModule,
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
