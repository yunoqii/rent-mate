import type { Listing, Preferences, Booking } from "../generated/prisma/client";

// Prisma returns Decimal objects for money columns.
// res.json() would turn them into strings, so we convert them to numbers in one place.
function toNumber(value: { toNumber(): number } | null): number | null {
    return value === null ? null : value.toNumber();
}

export function serializeListing(listing: Listing) {
    return {
        ...listing,
        price: listing.price.toNumber(),
        depositAmount: toNumber(listing.depositAmount),
    };
}

export function serializePreferences(preferences: Preferences) {
    return {
        ...preferences,
        minPrice: toNumber(preferences.minPrice),
        maxPrice: toNumber(preferences.maxPrice),
    };
}

// Booking comes with the listing included, so the nested listing is serialized too
export function serializeBooking(booking: Booking & { listing?: Listing }) {
    const { listing, ...rest } = booking;
    return listing ? { ...rest, listing: serializeListing(listing) } : rest;
}
