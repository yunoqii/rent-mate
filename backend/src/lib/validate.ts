// Small helpers for reading untrusted input (request body, query, LLM tool arguments).
// Each one returns the parsed value or undefined if the value is missing/invalid.

export function asString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
}

// Accepts 3500 and "3500" (query params are always strings)
export function asNumber(value: unknown): number | undefined {
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    if (typeof value === "string" && value.trim() !== "") {
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}

export function asInt(value: unknown): number | undefined {
    const n = asNumber(value);
    return n !== undefined && Number.isInteger(n) ? n : undefined;
}

// Accepts true/false and "true"/"false"
export function asBoolean(value: unknown): boolean | undefined {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return undefined;
}

export function asDate(value: unknown): Date | undefined {
    if (typeof value !== "string" && !(value instanceof Date)) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

// Returns the value if it is one of the enum values. Prisma enums are plain objects.
export function asEnum<T extends string>(value: unknown, enumObject: Record<string, T>): T | undefined {
    if (typeof value !== "string") return undefined;
    const upper = value.trim().toUpperCase();
    return (Object.values(enumObject) as string[]).includes(upper) ? (upper as T) : undefined;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
