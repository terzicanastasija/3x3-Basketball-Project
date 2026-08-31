import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ClipsController } from "./clips.controller";
import { ClipsService } from "./clips.service";
import { ClipGenerationWorker } from "./clip-generation.worker";
import { CompilationsController } from "./compilations.controller";
import { CompilationsService } from "./compilations.service";
import { S3Service } from "../../common/s3/s3.service";

@Module({
  imports: [ConfigModule],
  controllers: [ClipsController, CompilationsController],
  providers: [ClipsService, ClipGenerationWorker, CompilationsService, S3Service],
  exports: [ClipsService],
})
export class ClipsModule {}
