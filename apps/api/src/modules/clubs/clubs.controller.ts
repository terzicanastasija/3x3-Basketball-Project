import { Body, Controller, ForbiddenException, Get, Param, Patch, Post } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { ClubsService } from "./clubs.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentClubContext } from "../../common/decorators/club-context.decorator";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";
import {
  createClubSchema,
  CreateClubDto,
  createInviteSchema,
  CreateInviteDto,
  Role,
  updateClubSchema,
  UpdateClubDto,
} from "@3x3/shared";

@Controller()
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Get("clubs")
  list(@CurrentClubContext() clubContext: ClubContext) {
    return this.clubsService.list(clubContext);
  }

  @Get("clubs/:clubId")
  findOne(@Param("clubId") clubId: string, @CurrentClubContext() clubContext: ClubContext) {
    return this.clubsService.findOne(clubId, clubContext);
  }

  @Post("clubs")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createClubSchema)) dto: CreateClubDto
  ) {
    if (!user.isSuperadmin) {
      throw new ForbiddenException("Only a superadmin can create clubs.");
    }
    return this.clubsService.create(dto);
  }

  @Patch("clubs/:clubId")
  @Roles(Role.CLUB_ADMIN)
  update(
    @Param("clubId") clubId: string,
    @Body(new ZodValidationPipe(updateClubSchema)) dto: UpdateClubDto
  ) {
    return this.clubsService.update(clubId, dto);
  }

  @Post("clubs/:clubId/invites")
  @Roles(Role.CLUB_ADMIN)
  createInvite(
    @Param("clubId") clubId: string,
    @Body(new ZodValidationPipe(createInviteSchema)) dto: CreateInviteDto
  ) {
    return this.clubsService.createInvite(clubId, dto);
  }

  @Get("clubs/:clubId/invites")
  @Roles(Role.CLUB_ADMIN)
  listInvites(@Param("clubId") clubId: string) {
    return this.clubsService.listInvites(clubId);
  }
}
