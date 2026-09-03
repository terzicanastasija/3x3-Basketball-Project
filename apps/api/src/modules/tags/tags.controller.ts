import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { TagsService } from "./tags.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../common/types/authenticated-request";
import {
  createTagSchema,
  CreateTagDto,
  tagSearchQuerySchema,
  TagSearchQueryDto,
  updateTagSchema,
  UpdateTagDto,
} from "@3x3/shared";

@Controller()
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get("matches/:matchId/tags")
  listForMatch(@Param("matchId") matchId: string) {
    return this.tagsService.listForMatch(matchId);
  }

  @Get("tags")
  search(@Query(new ZodValidationPipe(tagSearchQuerySchema)) query: TagSearchQueryDto) {
    return this.tagsService.search(query);
  }

  @Post("tags/:tagId/review")
  review(@Param("tagId") tagId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tagsService.review(user, tagId);
  }

  @Post("matches/:matchId/tags")
  create(
    @Param("matchId") matchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createTagSchema)) dto: CreateTagDto
  ) {
    return this.tagsService.create(user, matchId, dto);
  }

  @Patch("tags/:tagId")
  update(
    @Param("tagId") tagId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateTagSchema)) dto: UpdateTagDto
  ) {
    return this.tagsService.update(user, tagId, dto);
  }

  @Delete("tags/:tagId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("tagId") tagId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.tagsService.remove(user, tagId);
  }

  @Post("matches/:matchId/lock")
  lockMatch(@Param("matchId") matchId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tagsService.lockMatch(user, matchId);
  }
}
