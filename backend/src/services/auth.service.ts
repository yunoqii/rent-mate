import prisma from "../lib/prisma";
import bcrypt from "bcrypt";
import { UserRole } from "../generated/prisma/enums";
import { Prisma } from "../generated/prisma/client";
import { EmailAlreadyExistsError, InvalidDataProvidedError, InvalidCredentialsError } from "../lib/errors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function normalizeEmail(email: unknown): string {
    if (typeof email !== "string") {
        throw new InvalidDataProvidedError("Email is required");
    }
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalized)) {
        throw new InvalidDataProvidedError("Email is not valid");
    }
    return normalized;
}

export async function registerUser(email: unknown, password: unknown, role: UserRole = UserRole.TENANT) {
    const normalizedEmail = normalizeEmail(email);

    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
        throw new InvalidDataProvidedError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    try {
        const user = await prisma.user.create({
            data: {
                email: normalizedEmail,
                passwordHash: await bcrypt.hash(password, 10),
                role,
            },
        });
        return { id: user.id, email: user.email, role: user.role };
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new EmailAlreadyExistsError();
        }
        // Anything else (DB down, bug) is passed on as is - the error handler logs it
        throw error;
    }
}

export async function authUser(email: unknown, password: unknown) {
    if (typeof email !== "string" || typeof password !== "string") {
        throw new InvalidDataProvidedError("Email and password are required");
    }

    const user = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
    });

    // Same error for "no such user" and "wrong password" - prevents user enumeration
    if (!user) {
        throw new InvalidCredentialsError();
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
        throw new InvalidCredentialsError();
    }

    return { id: user.id, email: user.email, role: user.role };
}

export async function getMe(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, username: true, phone: true, role: true, createdAt: true },
    });
    return user;
}
