// FILE = uploaded to S3-compatible object storage. EXTERNAL = a link (e.g. YouTube), no storage cost.
export enum VideoSourceType {
  FILE = "FILE",
  EXTERNAL = "EXTERNAL",
}

export enum VideoProcessingStatus {
  PENDING = "PENDING",
  UPLOADING = "UPLOADING",
  READY = "READY",
  FAILED = "FAILED",
}

export enum JobStatus {
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}
