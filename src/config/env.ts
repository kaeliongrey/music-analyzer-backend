import dotenv from "dotenv";
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL!,
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  aws: {
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    bucketName: process.env.S3_BUCKET_NAME || "music-collab-uploads",
  },
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || "500", 10),
};
