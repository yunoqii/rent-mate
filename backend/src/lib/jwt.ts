import jwt from "jsonwebtoken";
import { env } from "./env";
import { UserRole } from "../generated/prisma/enums";

export type TokenPayload = { id: string; email: string; role: UserRole };

export function signToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "1h" });
}

// Returns the payload or throws (bad signature, expired, malformed)
export function verifyToken(token: string): TokenPayload {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
