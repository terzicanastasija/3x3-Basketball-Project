import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { RostersService } from "./rosters.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentClubContext } from "../../common/decorators/club-context.decorator";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";
import {
  addRosterPlayerSchema,
  AddRosterPlayerDto,
  createRosterSchema,
  CreateRosterDto,
} from "@3x3/shared";

@Controller("teams/:teamId/rosters")
export class RostersController {
  constructor(private readonly rostersService: RostersService) {}

  @Get(":tournamentId")
  find(
    @Param("teamId") teamId: string,
    @Param("tournamentId") tournamentId: string,
    @CurrentClubContext() clubContext: ClubContext
  ) {
    return this.rostersService.find(teamId, tournamentId, clubContext);
  }

  @Post()
  createOrGet(
    @Param("teamId") teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createRosterSchema)) dto: CreateRosterDto
  ) {
    return this.rostersService.createOrGet(user, teamId, dto.tournamentId);
  }

  @Post(":tournamentId/players")
  addPlayer(
    @Param("teamId") teamId: string,
    @Param("tournamentId") tournamentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(addRosterPlayerSchema)) dto: AddRosterPlayerDto
  ) {
    return this.rostersService.addPlayer(user, teamId, tournamentId, dto);
  }

  @Delete(":tournamentId/players/:playerId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePlayer(
    @Param("teamId") teamId: string,
    @Param("tournamentId") tournamentId: string,
    @Param("playerId") playerId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.rostersService.removePlayer(user, teamId, tournamentId, playerId);
  }
}
