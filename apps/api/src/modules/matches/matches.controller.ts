import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { MatchesService } from "./matches.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../common/types/authenticated-request";
import {
  createMatchSchema,
  CreateMatchDto,
  recordMatchResultSchema,
  RecordMatchResultDto,
  updateMatchSchema,
  UpdateMatchDto,
} from "@3x3/shared";

@Controller()
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get("tournaments/:tournamentId/matches")
  listForTournament(@Param("tournamentId") tournamentId: string) {
    return this.matchesService.listForTournament(tournamentId);
  }

  @Get("matches/:matchId")
  findOne(@Param("matchId") matchId: string) {
    return this.matchesService.findOne(matchId);
  }

  @Post("tournaments/:tournamentId/matches")
  create(
    @Param("tournamentId") tournamentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createMatchSchema)) dto: CreateMatchDto
  ) {
    return this.matchesService.create(user, tournamentId, dto);
  }

  @Patch("matches/:matchId")
  update(
    @Param("matchId") matchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateMatchSchema)) dto: UpdateMatchDto
  ) {
    return this.matchesService.update(user, matchId, dto);
  }

  @Patch("matches/:matchId/result")
  recordResult(
    @Param("matchId") matchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(recordMatchResultSchema)) dto: RecordMatchResultDto
  ) {
    return this.matchesService.recordResult(user, matchId, dto);
  }

  @Delete("matches/:matchId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("matchId") matchId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.matchesService.remove(user, matchId);
  }
}
