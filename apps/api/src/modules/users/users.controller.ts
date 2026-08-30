import { Controller, Get } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentClubContext } from "../../common/decorators/club-context.decorator";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser, @CurrentClubContext() clubContext: ClubContext) {
    const profile = await this.usersService.findById(user.id);
    return { ...profile, clubContext };
  }
}
