import { Module } from "@nestjs/common";
import { ClubsController } from "./clubs.controller";
import { ClubsService } from "./clubs.service";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [MailModule],
  controllers: [ClubsController],
  providers: [ClubsService],
  exports: [ClubsService],
})
export class ClubsModule {}
