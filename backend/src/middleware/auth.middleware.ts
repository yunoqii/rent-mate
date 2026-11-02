import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { verifyToken } from "../lib/jwt";
import { UnauthorizedError, ForbiddenError } from "../lib/errors";
import { UserRole } from "../generated/prisma/enums";

// Extracts the token from "Authorization: Bearer <token>", or null
function getBearerToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return null;
    }
    return header.split(" ")[1] ?? null;
}

// Verifies the token and loads a fresh user from the DB
// (role could have changed, or the user could have been deleted after the token was issued)
async function loadUser(token: string) {
    let payload;
    try {
        payload = verifyToken(token);
    } catch {
        throw new UnauthorizedError("Invalid or expired token");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
        throw new UnauthorizedError("User no longer exists");
    }
    return { id: user.id, email: user.email, role: user.role };
}

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
    try {
        const token = getBearerToken(req);
        if (!token) {
            throw new UnauthorizedError("Missing or malformed authorization header");
        }
        req.user = await loadUser(token);
        next();
    } catch (error) {
        next(error);
    }
};

// Same as requireAuth, but anonymous requests are let through (req.user stays undefined).
// Used where being logged in only adds something (AI search ranks by your preferences).
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
    try {
        const token = getBearerToken(req);
        if (token) {
            req.user = await loadUser(token);
        }
        next();
    } catch (error) {
        next(error);
    }
};

// Middleware factory: returns a middleware that only lets the given roles through.
// Must be placed after requireAuth.
export const requireRole = (...allowedRoles: UserRole[]) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new UnauthorizedError());
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(new ForbiddenError("Your role is not allowed to do this"));
        }
        next();
    };
};
