import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { RostersService } from "./rosters.service";
import { CurrentClubContext } from "../../common/decorators/club-context.decorator";
import { ClubContext } from "../../common/types/authenticated-request";
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
    @Body(new ZodValidationPipe(createRosterSchema)) dto: CreateRosterDto,
    @CurrentClubContext() clubContext: ClubContext
  ) {
    return this.rostersService.createOrGet(teamId, dto.tournamentId, clubContext);
  }

  @Post(":tournamentId/players")
  addPlayer(
    @Param("teamId") teamId: string,
    @Param("tournamentId") tournamentId: string,
    @Body(new ZodValidationPipe(addRosterPlayerSchema)) dto: AddRosterPlayerDto,
    @CurrentClubContext() clubContext: ClubContext
  ) {
    return this.rostersService.addPlayer(teamId, tournamentId, dto, clubContext);
  }

  @Delete(":tournamentId/players/:playerId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePlayer(
    @Param("teamId") teamId: string,
    @Param("tournamentId") tournamentId: string,
    @Param("playerId") playerId: string,
    @CurrentClubContext() clubContext: ClubContext
  ) {
    await this.rostersService.removePlayer(teamId, tournamentId, playerId, clubContext);
  }
}
