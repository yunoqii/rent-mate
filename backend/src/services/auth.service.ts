import prisma from '../lib/prisma';
import bcrypt from 'bcrypt';
import { UserRole } from "../generated/prisma/enums";
import { Prisma } from "../generated/prisma/client";
import { EmailAlreadyExistsError } from '../lib/errors';

export async function registerUser(email: string, password: string, role?: UserRole) {
    if (typeof email !== 'string' || typeof password !== 'string') {
        throw new Error('Invalid data provided');
    }

    try {
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash: await bcrypt.hash(password, 10),
                role: role || UserRole.TENANT,
            },
        });
        return { email: user.email, role: user.role, id: user.id };
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new EmailAlreadyExistsError();
        }
        throw new Error('Failed to register user');
    }
};

