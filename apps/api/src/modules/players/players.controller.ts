import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { PlayersService } from "./players.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../common/types/authenticated-request";
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
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createPlayerSchema)) dto: CreatePlayerDto
  ) {
    return this.playersService.create(user, dto);
  }

  @Patch(":playerId")
  update(
    @Param("playerId") playerId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updatePlayerSchema)) dto: UpdatePlayerDto
  ) {
    return this.playersService.update(user, playerId, dto);
  }

  @Delete(":playerId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("playerId") playerId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.playersService.remove(user, playerId);
  }
}
