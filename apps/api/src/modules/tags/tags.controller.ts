import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { TagsService } from "./tags.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentClubContext } from "../../common/decorators/club-context.decorator";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";
import { createTagSchema, CreateTagDto, updateTagSchema, UpdateTagDto } from "@3x3/shared";

@Controller()
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get("matches/:matchId/tags")
  listForMatch(@Param("matchId") matchId: string) {
    return this.tagsService.listForMatch(matchId);
  }

  @Post("matches/:matchId/tags")
  create(
    @Param("matchId") matchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentClubContext() clubContext: ClubContext,
    @Body(new ZodValidationPipe(createTagSchema)) dto: CreateTagDto
  ) {
    return this.tagsService.create(user, clubContext, matchId, dto);
  }

  @Patch("tags/:tagId")
  update(
    @Param("tagId") tagId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentClubContext() clubContext: ClubContext,
    @Body(new ZodValidationPipe(updateTagSchema)) dto: UpdateTagDto
  ) {
    return this.tagsService.update(user, clubContext, tagId, dto);
  }

  @Delete("tags/:tagId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("tagId") tagId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentClubContext() clubContext: ClubContext
  ) {
    await this.tagsService.remove(user, clubContext, tagId);
  }

  @Post("matches/:matchId/lock")
  lockMatch(
    @Param("matchId") matchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentClubContext() clubContext: ClubContext
  ) {
    return this.tagsService.lockMatch(user, clubContext, matchId);
  }
}
