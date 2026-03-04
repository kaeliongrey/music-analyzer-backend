import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../config/s3";
import { env } from "../config/env";
import { v4 as uuid } from "uuid";
import path from "path";

export async function uploadToS3(
  file: Express.Multer.File,
  projectId: string
): Promise<{ s3Key: string }> {
  const ext = path.extname(file.originalname);
  const s3Key = `projects/${projectId}/${uuid()}${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.aws.bucketName,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return { s3Key };
}

export async function getDownloadUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.aws.bucketName,
    Key: s3Key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function deleteFromS3(s3Key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.aws.bucketName,
      Key: s3Key,
    })
  );
}
