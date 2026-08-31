import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { TeamsService } from "./teams.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentClubContext } from "../../common/decorators/club-context.decorator";
import { ClubContext } from "../../common/types/authenticated-request";
import { createTeamSchema, CreateTeamDto, Role, updateTeamSchema, UpdateTeamDto } from "@3x3/shared";

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

  @Post("clubs/:clubId/teams")
  @Roles(Role.CLUB_ADMIN)
  create(
    @Param("clubId") clubId: string,
    @Body(new ZodValidationPipe(createTeamSchema)) dto: CreateTeamDto
  ) {
    return this.teamsService.create(clubId, dto);
  }

  @Patch("clubs/:clubId/teams/:teamId")
  @Roles(Role.CLUB_ADMIN)
  update(
    @Param("clubId") clubId: string,
    @Param("teamId") teamId: string,
    @Body(new ZodValidationPipe(updateTeamSchema)) dto: UpdateTeamDto
  ) {
    return this.teamsService.update(clubId, teamId, dto);
  }

  @Delete("clubs/:clubId/teams/:teamId")
  @Roles(Role.CLUB_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("clubId") clubId: string, @Param("teamId") teamId: string) {
    await this.teamsService.remove(clubId, teamId);
  }
}
