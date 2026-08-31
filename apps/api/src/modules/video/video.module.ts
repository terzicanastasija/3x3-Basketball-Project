import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { VideoController } from "./video.controller";
import { VideoService } from "./video.service";
import { S3Service } from "../../common/s3/s3.service";

@Module({
  imports: [ConfigModule],
  controllers: [VideoController],
  providers: [VideoService, S3Service],
  exports: [VideoService],
})
export class VideoModule {}
