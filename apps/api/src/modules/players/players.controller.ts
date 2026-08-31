import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { PlayersService } from "./players.service";
import { CurrentClubContext } from "../../common/decorators/club-context.decorator";
import { ClubContext } from "../../common/types/authenticated-request";
import {
  createPlayerSchema,
  CreatePlayerDto,
  playerSearchQuerySchema,
  PlayerSearchQueryDto,
  updatePlayerSchema,
  UpdatePlayerDto,
} from "@3x3/shared";

@Controller("players")
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  search(@Query(new ZodValidationPipe(playerSearchQuerySchema)) query: PlayerSearchQueryDto) {
    return this.playersService.search(query);
  }

  @Get(":playerId")
  findOne(@Param("playerId") playerId: string) {
    return this.playersService.findOne(playerId);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createPlayerSchema)) dto: CreatePlayerDto,
    @CurrentClubContext() clubContext: ClubContext
  ) {
    return this.playersService.create(dto, clubContext);
  }

  @Patch(":playerId")
  update(
    @Param("playerId") playerId: string,
    @Body(new ZodValidationPipe(updatePlayerSchema)) dto: UpdatePlayerDto,
    @CurrentClubContext() clubContext: ClubContext
  ) {
    return this.playersService.update(playerId, dto, clubContext);
  }

  @Delete(":playerId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("playerId") playerId: string, @CurrentClubContext() clubContext: ClubContext) {
    await this.playersService.remove(playerId, clubContext);
  }
}
