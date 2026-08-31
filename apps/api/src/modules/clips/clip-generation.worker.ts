import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { spawn } from "child_process";
import { mkdtemp, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import ffmpegPath from "ffmpeg-static";
import { JobStatus } from "@3x3/shared";
import { REDIS_CONNECTION } from "../../common/queue/redis-connection";
import { CLIP_GENERATION_QUEUE_NAME, ClipGenerationJobData } from "../../common/queue/clip-generation-queue.service";
import { PrismaService } from "../../prisma/prisma.service";
import { S3Service } from "../../common/s3/s3.service";
import { computeClipWindow } from "./clip-window";

// Runs in-process within the Nest app — same single-worker-process pattern as
// StatRecomputeWorker (Phase 4). Only ever handles FILE-source tags; EXTERNAL (YouTube) tags
// never get a ClipJob/queue entry at all (see TagsService.create).
@Injectable()
export class ClipGenerationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClipGenerationWorker.name);
  private worker?: Worker<ClipGenerationJobData>;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: IORedis,
    private readonly prisma: PrismaService,
    private readonly s3: S3Service
  ) {}

  onModuleInit() {
    this.worker = new Worker<ClipGenerationJobData>(
      CLIP_GENERATION_QUEUE_NAME,
      async (job) => {
        await this.processJob(job.data.actionTagId);
      },
      { connection: this.connection }
    );
    this.worker.on("failed", (job, err) => {
      this.logger.error(`clip-generation job ${job?.id} failed for tag ${job?.data.actionTagId}: ${err.message}`);
    });
  }

  private async processJob(actionTagId: string) {
    const tag = await this.prisma.actionTag.findUnique({
      where: { id: actionTagId },
      include: { videoAsset: true },
    });
    if (!tag || !tag.videoAsset || !tag.videoAsset.fileKey) {
      throw new Error(`Tag ${actionTagId} has no FILE-source video to cut a clip from.`);
    }

    const workDir = await mkdtemp(join(tmpdir(), "3x3-clip-"));
    const inputPath = join(workDir, "source.mp4");
    const outputPath = join(workDir, "clip.mp4");

    try {
      await this.prisma.clipJob.update({ where: { actionTagId }, data: { status: JobStatus.PROCESSING } });

      await this.s3.downloadVideoToFile(tag.videoAsset.fileKey, inputPath);

      const { start, duration } = computeClipWindow(tag.timestampSec);
      await runFfmpeg(inputPath, outputPath, start, duration);

      // Don't trust the process exit code alone (Phase 4 already taught this project that
      // "the job reports success" isn't proof of anything) — check real output exists.
      const outputStat = await stat(outputPath);
      if (outputStat.size === 0) {
        throw new Error("ffmpeg produced an empty output file.");
      }

      const outputKey = `clips/${actionTagId}.mp4`;
      await this.s3.uploadClip(outputKey, outputPath);

      await this.prisma.clipJob.update({
        where: { actionTagId },
        data: { status: JobStatus.COMPLETED, outputKey, errorMessage: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.clipJob.update({
        where: { actionTagId },
        data: { status: JobStatus.FAILED, errorMessage: message.slice(0, 1000) },
      });
      throw error;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}

function runFfmpeg(inputPath: string, outputPath: string, start: number, duration: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg-static did not resolve a binary path on this platform."));
      return;
    }
    // -ss before -i: fast input-side seeking (snaps to the nearest keyframe, not
    // frame-accurate) paired with -c copy (stream copy, no re-encode) — the plan's explicitly
    // accepted speed/precision tradeoff, not a bug to "fix" with a slower re-encode.
    const args = ["-ss", String(start), "-i", inputPath, "-t", String(duration), "-c", "copy", "-y", outputPath];
    const proc = spawn(ffmpegPath, args);
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}
