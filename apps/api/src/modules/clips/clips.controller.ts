import { Controller, Get, Param } from "@nestjs/common";
import { ClipsService } from "./clips.service";

@Controller()
export class ClipsController {
  constructor(private readonly clipsService: ClipsService) {}

  @Get("tags/:tagId/clip")
  getTagClip(@Param("tagId") tagId: string) {
    return this.clipsService.resolveTagClip(tagId);
  }
}
