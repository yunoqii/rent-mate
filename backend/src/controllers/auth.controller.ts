import { Request, Response, NextFunction } from "express";
import { registerUser, authUser, getMe } from "../services/auth.service";
import { signToken } from "../lib/jwt";
import { InvalidDataProvidedError, NotFoundError } from "../lib/errors";
import { UserRole } from "../generated/prisma/enums";

// Only these roles can be chosen at sign-up. ADMIN is never given through a public endpoint.
const PUBLIC_ROLES: UserRole[] = [UserRole.TENANT, UserRole.LANDLORD];

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password, role } = req.body ?? {};

        if (role !== undefined && !PUBLIC_ROLES.includes(role)) {
            throw new InvalidDataProvidedError("role must be TENANT or LANDLORD");
        }

        const user = await registerUser(email, password, role);
        // Issuing the token is an HTTP/session concern, so it lives in the controller
        return res.status(201).json({ token: signToken(user), user });
    } catch (error) {
        next(error);
    }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body ?? {};
        const user = await authUser(email, password);
        return res.json({ token: signToken(user), user });
    } catch (error) {
        next(error);
    }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await getMe(req.user!.id);
        if (!user) throw new NotFoundError("User not found");
        return res.json(user);
    } catch (error) {
        next(error);
    }
};
