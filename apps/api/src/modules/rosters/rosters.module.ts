import { Module } from "@nestjs/common";
import { RostersController } from "./rosters.controller";
import { RostersService } from "./rosters.service";

@Module({
  controllers: [RostersController],
  providers: [RostersService],
  exports: [RostersService],
})
export class RostersModule {}
