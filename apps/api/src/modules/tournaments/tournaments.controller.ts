import { Controller, Get } from "@nestjs/common";
import { TournamentsService } from "./tournaments.service";

@Controller("tournaments")
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get()
  list() {
    return this.tournamentsService.list();
  }
}
