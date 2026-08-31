import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Env } from "../../config/env.validation";

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const PLAYBACK_URL_TTL_SECONDS = 60 * 60;

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly videosBucket: string;

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
}
