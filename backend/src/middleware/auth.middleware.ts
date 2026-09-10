import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { UnauthorizedError, AppError } from "../lib/errors";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Missing or malformed authorization header" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
            id: string;
            email: string;
            role: string;
        };

        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) {
            throw new UnauthorizedError("User no longer exists");
        }

        req.user = { id: user.id, email: user.email, role: user.role };

        next();
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};
