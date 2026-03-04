import { Request } from "express";

export interface AuthRequest extends Request {
  userId?: string;
}

export interface JwtPayload {
  userId: string;
}

export const DAW_TYPES = [
  "ableton",
  "fl-studio",
  "logic-pro",
  "pro-tools",
  "cubase",
  "reaper",
  "studio-one",
  "bitwig",
  "reason",
  "garageband",
  "other",
] as const;

export type DawType = (typeof DAW_TYPES)[number];

export const FILE_TYPES = [
  "project",
  "stem",
  "sample",
  "midi",
  "other",
] as const;

export type FileType = (typeof FILE_TYPES)[number];

export const DAW_EXTENSIONS: Record<string, string> = {
  ".als": "ableton",
  ".adg": "ableton",
  ".flp": "fl-studio",
  ".logicx": "logic-pro",
  ".ptx": "pro-tools",
  ".cpr": "cubase",
  ".rpp": "reaper",
  ".song": "studio-one",
  ".bwproject": "bitwig",
  ".reason": "reason",
  ".band": "garageband",
};
