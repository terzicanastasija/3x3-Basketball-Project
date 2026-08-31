import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createWriteStream } from "fs";
import { readFile } from "fs/promises";
import { pipeline } from "stream/promises";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Env } from "../../config/env.validation";

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const PLAYBACK_URL_TTL_SECONDS = 60 * 60;

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly videosBucket: string;
  private readonly clipsBucket: string;

  constructor(private readonly configService: ConfigService<Env, true>) {
    this.client = new S3Client({
      endpoint: this.configService.get("S3_ENDPOINT", { infer: true }),
      region: this.configService.get("S3_REGION", { infer: true }),
      forcePathStyle: this.configService.get("S3_FORCE_PATH_STYLE", { infer: true }),
      credentials: {
        accessKeyId: this.configService.get("S3_ACCESS_KEY_ID", { infer: true }),
        secretAccessKey: this.configService.get("S3_SECRET_ACCESS_KEY", { infer: true }),
      },
    });
    this.videosBucket = this.configService.get("S3_BUCKET_VIDEOS", { infer: true });
    this.clipsBucket = this.configService.get("S3_BUCKET_CLIPS", { infer: true });
  }

  getUploadUrl(fileKey: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.videosBucket,
      Key: fileKey,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  }

  getPlaybackUrl(fileKey: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.videosBucket, Key: fileKey });
    return getSignedUrl(this.client, command, { expiresIn: PLAYBACK_URL_TTL_SECONDS });
  }

  async deleteObject(fileKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.videosBucket, Key: fileKey }));
  }

  // Clip generation (Phase 5): the worker downloads the source video server-side (no presigned
  // URL needed, this is a trusted internal read) to cut a clip with ffmpeg, then uploads the
  // result to the clips bucket directly (also trusted server-side, unlike the browser's presigned
  // PUT upload flow for source videos).
  async downloadVideoToFile(fileKey: string, destPath: string): Promise<void> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.videosBucket, Key: fileKey })
    );
    const body = response.Body as NodeJS.ReadableStream | undefined;
    if (!body) {
      throw new Error(`No body returned for video object ${fileKey}`);
    }
    await pipeline(body, createWriteStream(destPath));
  }

  async uploadClip(fileKey: string, filePath: string, contentType = "video/mp4"): Promise<void> {
    const body = await readFile(filePath);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.clipsBucket, Key: fileKey, Body: body, ContentType: contentType })
    );
  }

  getClipPlaybackUrl(fileKey: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.clipsBucket, Key: fileKey });
    return getSignedUrl(this.client, command, { expiresIn: PLAYBACK_URL_TTL_SECONDS });
  }
}
