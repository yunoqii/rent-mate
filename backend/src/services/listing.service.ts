import prisma from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
import { PropertyType, ListingStatus, UserRole } from "../generated/prisma/enums";
import { InvalidDataProvidedError, NotFoundError, ForbiddenError } from "../lib/errors";
import { asString, asNumber, asInt, asBoolean, asDate, asEnum, isPlainObject } from "../lib/validate";

// ---------- Search filters ----------
// One filter shape for both GET /listings (query params) and the AI layer (LLM tool arguments).

export type ListingFilters = {
    city?: string;
    neighborhood?: string;
    propertyType?: PropertyType;
    status?: ListingStatus;
    minPrice?: number;
    maxPrice?: number;
    minRooms?: number;
    maxRooms?: number;
    minArea?: number;
    maxArea?: number;
    petsAllowed?: boolean;
    smokingAllowed?: boolean;
    furnished?: boolean;
    hasBalcony?: boolean;
    hasParking?: boolean;
    hasElevator?: boolean;
    utilitiesIncluded?: boolean;
    remoteWorkFriendly?: boolean;
    availableFrom?: Date; // listing must be available on or before this date
};

export const SORT_OPTIONS = ["newest", "price_asc", "price_desc", "area_desc"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

const BOOLEAN_FILTERS = [
    "petsAllowed", "smokingAllowed", "furnished", "hasBalcony",
    "hasParking", "hasElevator", "utilitiesIncluded", "remoteWorkFriendly",
] as const;

// Invalid numbers are silently ignored (a broken link should not break the search),
// invalid enum values are a 400 (otherwise the user just sees "nothing found" and wonders why).
export function parseListingFilters(raw: Record<string, unknown>): ListingFilters {
    const filters: ListingFilters = {};

    const city = asString(raw.city);
    if (city) filters.city = city;
    const neighborhood = asString(raw.neighborhood);
    if (neighborhood) filters.neighborhood = neighborhood;

    if (raw.propertyType !== undefined) {
        const propertyType = asEnum(raw.propertyType, PropertyType);
        if (!propertyType) throw new InvalidDataProvidedError("Invalid propertyType");
        filters.propertyType = propertyType;
    }
    if (raw.status !== undefined) {
        const status = asEnum(raw.status, ListingStatus);
        if (!status) throw new InvalidDataProvidedError("Invalid status");
        filters.status = status;
    }

    const numberKeys = ["minPrice", "maxPrice", "minArea", "maxArea"] as const;
    for (const key of numberKeys) {
        const value = asNumber(raw[key]);
        if (value !== undefined && value >= 0) filters[key] = value;
    }
    const intKeys = ["minRooms", "maxRooms"] as const;
    for (const key of intKeys) {
        const value = asInt(raw[key]);
        if (value !== undefined && value >= 0) filters[key] = value;
    }
    // Old name from the first version of the API: ?rooms=2 means exactly 2 rooms
    const rooms = asInt(raw.rooms);
    if (rooms !== undefined) {
        filters.minRooms = rooms;
        filters.maxRooms = rooms;
    }

    for (const key of BOOLEAN_FILTERS) {
        const value = asBoolean(raw[key]);
        if (value !== undefined) filters[key] = value;
    }

    const availableFrom = asDate(raw.availableFrom);
    if (availableFrom) filters.availableFrom = availableFrom;

    return filters;
}

// Turns filters into a Prisma where clause. Keys are only added when the filter is set
// (exactOptionalPropertyTypes does not allow { city: undefined }).
export function buildListingWhere(filters: ListingFilters): Prisma.ListingWhereInput {
    const where: Prisma.ListingWhereInput = {
        // Rented / inactive listings are hidden unless asked for explicitly
        status: filters.status ?? ListingStatus.AVAILABLE,
    };

    if (filters.city) where.city = { equals: filters.city, mode: "insensitive" };
    if (filters.neighborhood) where.neighborhood = { contains: filters.neighborhood, mode: "insensitive" };
    if (filters.propertyType) where.propertyType = filters.propertyType;

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        where.price = {
            ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
        };
    }
    if (filters.minRooms !== undefined || filters.maxRooms !== undefined) {
        where.rooms = {
            ...(filters.minRooms !== undefined ? { gte: filters.minRooms } : {}),
            ...(filters.maxRooms !== undefined ? { lte: filters.maxRooms } : {}),
        };
    }
    if (filters.minArea !== undefined || filters.maxArea !== undefined) {
        where.area = {
            ...(filters.minArea !== undefined ? { gte: filters.minArea } : {}),
            ...(filters.maxArea !== undefined ? { lte: filters.maxArea } : {}),
        };
    }

    for (const key of BOOLEAN_FILTERS) {
        const value = filters[key];
        // "petsAllowed=false" means "I don't care", not "pets must be forbidden"
        if (value === true) where[key] = true;
    }

    if (filters.availableFrom) {
        // null availableFrom = available right away
        where.OR = [{ availableFrom: null }, { availableFrom: { lte: filters.availableFrom } }];
    }

    return where;
}

function buildOrderBy(sort: SortOption): Prisma.ListingOrderByWithRelationInput {
    switch (sort) {
        case "price_asc": return { price: "asc" };
        case "price_desc": return { price: "desc" };
        case "area_desc": return { area: "desc" };
        default: return { createdAt: "desc" };
    }
}

export type Pagination = { page: number; limit: number; sort: SortOption };

export function parsePagination(raw: Record<string, unknown>): Pagination {
    const page = asInt(raw.page);
    const limit = asInt(raw.limit);
    const sort = SORT_OPTIONS.find((option) => option === raw.sort) ?? "newest";
    return {
        page: page !== undefined && page > 0 ? page : 1,
        limit: limit !== undefined && limit > 0 ? Math.min(limit, 50) : 20,
        sort,
    };
}

export async function searchListings(filters: ListingFilters, pagination: Pagination) {
    const where = buildListingWhere(filters);
    // Two queries in one transaction: the page itself and the total count for the UI
    const [items, total] = await prisma.$transaction([
        prisma.listing.findMany({
            where,
            orderBy: buildOrderBy(pagination.sort),
            skip: (pagination.page - 1) * pagination.limit,
            take: pagination.limit,
        }),
        prisma.listing.count({ where }),
    ]);
    return { items, total, page: pagination.page, limit: pagination.limit };
}

// Used by the AI layer: all matches (capped), ranking happens afterwards in memory
export async function findListingsForRanking(filters: ListingFilters, cap = 100) {
    return prisma.listing.findMany({
        where: buildListingWhere(filters),
        orderBy: { createdAt: "desc" },
        take: cap,
    });
}

export async function getListingById(id: string) {
    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundError("Listing not found");
    return listing;
}

export async function getListingsByLandlord(landlordId: string) {
    return prisma.listing.findMany({ where: { landlordId }, orderBy: { createdAt: "desc" } });
}

// ---------- Create / update ----------
// Whitelist: we COPY known fields into a new object, so unknown fields
// (id, landlordId, createdAt...) can never reach Prisma (mass assignment).

type ListingInput = Omit<Prisma.ListingUncheckedCreateInput, "id" | "landlordId" | "createdAt" | "updatedAt">;

const REQUIRED_FIELDS = ["title", "description", "propertyType", "city", "address", "price", "area", "rooms", "latitude", "longitude"] as const;

function parseListingBody(body: unknown, { partial }: { partial: boolean }): Partial<ListingInput> {
    if (!isPlainObject(body)) throw new InvalidDataProvidedError("Body must be a JSON object");

    const data: Partial<ListingInput> = {};

    for (const key of ["title", "description", "city", "address"] as const) {
        if (body[key] === undefined) continue;
        const value = asString(body[key]);
        if (!value) throw new InvalidDataProvidedError(`${key} must be a non-empty string`);
        data[key] = value;
    }
    if (body.neighborhood !== undefined) {
        data.neighborhood = body.neighborhood === null ? null : asString(body.neighborhood) ?? null;
    }

    if (body.propertyType !== undefined) {
        const value = asEnum(body.propertyType, PropertyType);
        if (!value) throw new InvalidDataProvidedError("Invalid propertyType");
        data.propertyType = value;
    }
    // Status can only be changed on update, a new listing is always AVAILABLE
    if (partial && body.status !== undefined) {
        const value = asEnum(body.status, ListingStatus);
        if (!value) throw new InvalidDataProvidedError("Invalid status");
        data.status = value;
    }

    for (const key of ["price", "area"] as const) {
        if (body[key] === undefined) continue;
        const value = asNumber(body[key]);
        if (value === undefined || value <= 0) throw new InvalidDataProvidedError(`${key} must be a positive number`);
        data[key] = value;
    }
    if (body.depositAmount !== undefined) {
        const value = body.depositAmount === null ? null : asNumber(body.depositAmount);
        if (value === undefined || (value !== null && value < 0)) throw new InvalidDataProvidedError("depositAmount must be >= 0 or null");
        data.depositAmount = value;
    }

    if (body.latitude !== undefined) {
        const value = asNumber(body.latitude);
        if (value === undefined || value < -90 || value > 90) throw new InvalidDataProvidedError("latitude must be between -90 and 90");
        data.latitude = value;
    }
    if (body.longitude !== undefined) {
        const value = asNumber(body.longitude);
        if (value === undefined || value < -180 || value > 180) throw new InvalidDataProvidedError("longitude must be between -180 and 180");
        data.longitude = value;
    }

    if (body.rooms !== undefined) {
        const value = asInt(body.rooms);
        if (value === undefined || value < 1) throw new InvalidDataProvidedError("rooms must be a positive integer");
        data.rooms = value;
    }
    for (const key of ["floor", "totalFloors", "maxOccupants", "minLeaseMonths"] as const) {
        if (body[key] === undefined) continue;
        const value = body[key] === null ? null : asInt(body[key]);
        if (value === undefined) throw new InvalidDataProvidedError(`${key} must be an integer or null`);
        data[key] = value;
    }

    for (const key of BOOLEAN_FILTERS) {
        if (body[key] === undefined) continue;
        const value = asBoolean(body[key]);
        if (value === undefined) throw new InvalidDataProvidedError(`${key} must be a boolean`);
        data[key] = value;
    }

    if (body.availableFrom !== undefined) {
        const value = body.availableFrom === null ? null : asDate(body.availableFrom);
        if (value === undefined) throw new InvalidDataProvidedError("availableFrom must be a date or null");
        data.availableFrom = value;
    }

    if (!partial) {
        const missing = REQUIRED_FIELDS.filter((key) => data[key] === undefined);
        if (missing.length > 0) throw new InvalidDataProvidedError(`Missing required fields: ${missing.join(", ")}`);
    }
    if (partial && Object.keys(data).length === 0) {
        throw new InvalidDataProvidedError("No valid fields to update");
    }

    return data;
}

export async function createListing(landlordId: string, body: unknown) {
    const data = parseListingBody(body, { partial: false }) as ListingInput;
    return prisma.listing.create({ data: { ...data, landlordId } });
}

type Actor = { id: string; role: UserRole };

// Order of checks: exists (404) -> allowed (403)
async function getOwnedListing(id: string, actor: Actor) {
    const listing = await getListingById(id);
    if (listing.landlordId !== actor.id && actor.role !== UserRole.ADMIN) {
        throw new ForbiddenError("You can only modify your own listings");
    }
    return listing;
}

export async function updateListing(id: string, actor: Actor, body: unknown) {
    await getOwnedListing(id, actor);
    const data = parseListingBody(body, { partial: true });
    return prisma.listing.update({ where: { id }, data });
}

export async function deleteListing(id: string, actor: Actor) {
    await getOwnedListing(id, actor);
    // Booking has a foreign key to Listing, so bookings go first (in one transaction)
    await prisma.$transaction([
        prisma.booking.deleteMany({ where: { listingId: id } }),
        prisma.listing.delete({ where: { id } }),
    ]);
}
