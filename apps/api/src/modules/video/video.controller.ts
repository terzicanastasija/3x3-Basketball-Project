import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { VideoService } from "./video.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentClubContext } from "../../common/decorators/club-context.decorator";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";
import {
  registerVideoSchema,
  RegisterVideoDto,
  requestUploadUrlSchema,
  RequestUploadUrlDto,
} from "@3x3/shared";

@Controller()
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get("matches/:matchId/videos")
  listForMatch(@Param("matchId") matchId: string) {
    return this.videoService.listForMatch(matchId);
  }

  @Post("matches/:matchId/videos/upload-url")
  requestUploadUrl(
    @Param("matchId") matchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentClubContext() clubContext: ClubContext,
    @Body(new ZodValidationPipe(requestUploadUrlSchema)) dto: RequestUploadUrlDto
  ) {
    return this.videoService.requestUploadUrl(user, clubContext, matchId, dto);
  }

  @Post("matches/:matchId/videos")
  register(
    @Param("matchId") matchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentClubContext() clubContext: ClubContext,
    @Body(new ZodValidationPipe(registerVideoSchema)) dto: RegisterVideoDto
  ) {
    return this.videoService.register(user, clubContext, matchId, dto);
  }

  @Get("videos/:videoAssetId/playback-url")
  getPlaybackUrl(@Param("videoAssetId") videoAssetId: string) {
    return this.videoService.getPlaybackUrl(videoAssetId);
  }

  @Delete("videos/:videoAssetId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("videoAssetId") videoAssetId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentClubContext() clubContext: ClubContext
  ) {
    await this.videoService.remove(user, clubContext, videoAssetId);
  }
}
