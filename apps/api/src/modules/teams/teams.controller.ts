import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { TeamsService } from "./teams.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentClubContext } from "../../common/decorators/club-context.decorator";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";
import { createTeamSchema, CreateTeamDto, updateTeamSchema, UpdateTeamDto } from "@3x3/shared";

@Controller()
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get("clubs/:clubId/teams")
  listForClub(@Param("clubId") clubId: string, @CurrentClubContext() clubContext: ClubContext) {
    return this.teamsService.listForClub(clubId, clubContext);
  }

  @Get("teams/:teamId")
  findOne(@Param("teamId") teamId: string, @CurrentClubContext() clubContext: ClubContext) {
    return this.teamsService.findOne(teamId, clubContext);
  }

  // Team management is Admin-only (see PROGRESS.md's RBAC overhaul note) — checked inline
  // here rather than via @Roles(...), same explicit pattern ClubsController.create() already
  // uses, since no non-superadmin role should ever pass regardless of club membership.
  @Post("clubs/:clubId/teams")
  create(
    @Param("clubId") clubId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTeamSchema)) dto: CreateTeamDto
  ) {
    if (!user.isSuperadmin) {
      throw new ForbiddenException("Only an Admin can create teams.");
    }
    return this.teamsService.create(clubId, dto);
  }

  @Patch("clubs/:clubId/teams/:teamId")
  update(
    @Param("clubId") clubId: string,
    @Param("teamId") teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateTeamSchema)) dto: UpdateTeamDto
  ) {
    if (!user.isSuperadmin) {
      throw new ForbiddenException("Only an Admin can edit teams.");
    }
    return this.teamsService.update(clubId, teamId, dto);
  }

  @Delete("clubs/:clubId/teams/:teamId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("clubId") clubId: string,
    @Param("teamId") teamId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    if (!user.isSuperadmin) {
      throw new ForbiddenException("Only an Admin can delete teams.");
    }
    await this.teamsService.remove(clubId, teamId);
  }
}
