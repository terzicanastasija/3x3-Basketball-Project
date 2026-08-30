import { Body, Controller, Post } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { AuthService } from "./auth.service";
import { Public } from "../../common/decorators/public.decorator";
import {
  acceptInviteSchema,
  AcceptInviteDto,
  loginSchema,
  LoginDto,
  refreshSchema,
  RefreshDto,
} from "@3x3/shared";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post("refresh")
  refresh(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post("invite/accept")
  acceptInvite(@Body(new ZodValidationPipe(acceptInviteSchema)) dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto);
  }
}
