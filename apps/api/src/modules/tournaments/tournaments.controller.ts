import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { TournamentsService } from "./tournaments.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentClubContext } from "../../common/decorators/club-context.decorator";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";
import {
  createTournamentSchema,
  CreateTournamentDto,
  updateTournamentSchema,
  UpdateTournamentDto,
} from "@3x3/shared";

@Controller("tournaments")
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  list() {
    return this.tournamentsService.list();
  }

  @Get(":tournamentId")
  findOne(@Param("tournamentId") tournamentId: string) {
    return this.tournamentsService.findOne(tournamentId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentClubContext() clubContext: ClubContext,
    @Body(new ZodValidationPipe(createTournamentSchema)) dto: CreateTournamentDto
  ) {
    return this.tournamentsService.create(user, clubContext, dto);
  }

  @Patch(":tournamentId")
  update(
    @Param("tournamentId") tournamentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentClubContext() clubContext: ClubContext,
    @Body(new ZodValidationPipe(updateTournamentSchema)) dto: UpdateTournamentDto
  ) {
    return this.tournamentsService.update(user, clubContext, tournamentId, dto);
  }

  @Delete(":tournamentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("tournamentId") tournamentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentClubContext() clubContext: ClubContext
  ) {
    await this.tournamentsService.remove(user, clubContext, tournamentId);
  }
}
