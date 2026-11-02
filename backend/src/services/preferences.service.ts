import prisma from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
import { PropertyType } from "../generated/prisma/enums";
import { InvalidDataProvidedError, NotFoundError } from "../lib/errors";
import { asString, asNumber, asInt, asBoolean, asDate, asEnum, isPlainObject } from "../lib/validate";

type PreferencesInput = Omit<Prisma.PreferencesUncheckedCreateInput, "id" | "userId" | "createdAt" | "updatedAt">;

// Whitelist parser. Every field is optional; null clears the field.
function parsePreferencesBody(body: unknown): PreferencesInput {
    if (!isPlainObject(body)) throw new InvalidDataProvidedError("Body must be a JSON object");
    const data: PreferencesInput = {};

    for (const key of ["wantsPetsAllowed", "wantsSmokingAllowed", "wantsRemoteWork"] as const) {
        if (body[key] === undefined) continue;
        const value = asBoolean(body[key]);
        if (value === undefined) throw new InvalidDataProvidedError(`${key} must be a boolean`);
        data[key] = value;
    }

    if (body.desiredPropertyType !== undefined) {
        const value = body.desiredPropertyType === null ? null : asEnum(body.desiredPropertyType, PropertyType);
        if (value === undefined) throw new InvalidDataProvidedError("Invalid desiredPropertyType");
        data.desiredPropertyType = value;
    }

    for (const key of ["desiredCity", "desiredNeighborhood"] as const) {
        if (body[key] === undefined) continue;
        data[key] = body[key] === null ? null : asString(body[key]) ?? null;
    }

    if (body.moveInDate !== undefined) {
        const value = body.moveInDate === null ? null : asDate(body.moveInDate);
        if (value === undefined) throw new InvalidDataProvidedError("moveInDate must be a date or null");
        data.moveInDate = value;
    }

    for (const key of ["minPrice", "maxPrice", "minArea", "maxArea"] as const) {
        if (body[key] === undefined) continue;
        const value = body[key] === null ? null : asNumber(body[key]);
        if (value === undefined || (value !== null && value < 0)) throw new InvalidDataProvidedError(`${key} must be >= 0 or null`);
        data[key] = value;
    }
    if (body.minRooms !== undefined) {
        const value = body.minRooms === null ? null : asInt(body.minRooms);
        if (value === undefined || (value !== null && value < 1)) throw new InvalidDataProvidedError("minRooms must be a positive integer or null");
        data.minRooms = value;
    }

    const min = typeof data.minPrice === "number" ? data.minPrice : undefined;
    const max = typeof data.maxPrice === "number" ? data.maxPrice : undefined;
    if (min !== undefined && max !== undefined && min > max) {
        throw new InvalidDataProvidedError("minPrice cannot be greater than maxPrice");
    }

    return data;
}

export async function getPreferences(userId: string) {
    const preferences = await prisma.preferences.findUnique({ where: { userId } });
    if (!preferences) throw new NotFoundError("Preferences not filled in yet");
    return preferences;
}

// Same as getPreferences, but null instead of 404 (AI ranking works without a profile)
export async function findPreferences(userId: string) {
    return prisma.preferences.findUnique({ where: { userId } });
}

// upsert = "update if exists, create otherwise" in one query -> idempotent -> PUT
export async function upsertPreferences(userId: string, body: unknown) {
    const data = parsePreferencesBody(body);
    return prisma.preferences.upsert({
        where: { userId },
        create: { ...data, userId },
        update: data,
    });
}
