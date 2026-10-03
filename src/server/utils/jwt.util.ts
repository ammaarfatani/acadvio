import jwt, { Secret } from "jsonwebtoken";
import { env } from "../config/env";
import { UserType } from "../constants/roles.constant";

export interface JwtPayloadData {
  userId: string;
  email: string;
  userType: UserType;
  schoolId?: string | null;
  permissions?: string[];
}

export const generateAccessToken = (payload: JwtPayloadData): string => {
  const secret: Secret = env.JWT_ACCESS_SECRET;
  return jwt.sign(payload, secret, {
    expiresIn: "15m",
  });
};

export const generateRefreshToken = (payload: { userId: string }): string => {
  const secret: Secret = env.JWT_REFRESH_SECRET;
  return jwt.sign(payload, secret, {
    expiresIn: "7d",
  });
};

export const verifyAccessToken = (token: string): JwtPayloadData => {
  const secret: Secret = env.JWT_ACCESS_SECRET;
  return jwt.verify(token, secret) as JwtPayloadData;
};

export const verifyRefreshToken = (token: string): { userId: string } => {
  const secret: Secret = env.JWT_REFRESH_SECRET;
  return jwt.verify(token, secret) as { userId: string };
};
