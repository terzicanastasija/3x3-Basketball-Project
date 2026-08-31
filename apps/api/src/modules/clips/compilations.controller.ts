import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { createCompilationSchema, CreateCompilationDto } from "@3x3/shared";
import { CompilationsService } from "./compilations.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../common/types/authenticated-request";

@Controller("compilations")
export class CompilationsController {
  constructor(private readonly compilationsService: CompilationsService) {}

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.compilationsService.findMine(user);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCompilationSchema)) dto: CreateCompilationDto
  ) {
    return this.compilationsService.create(user, dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.compilationsService.findOne(id);
  }
}
