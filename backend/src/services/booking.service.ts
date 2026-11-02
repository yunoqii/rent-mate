import prisma from "../lib/prisma";
import { BookingStatus, ListingStatus, UserRole } from "../generated/prisma/enums";
import { InvalidDataProvidedError, NotFoundError, ForbiddenError, ConflictError } from "../lib/errors";
import { asString, asDate, asEnum, isPlainObject } from "../lib/validate";

type Actor = { id: string; role: UserRole };

// Final states: once a booking is here, its status can't change any more
const FINAL_STATUSES: BookingStatus[] = [BookingStatus.CANCELLED, BookingStatus.COMPLETED];
const LANDLORD_STATUSES: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.CANCELLED, BookingStatus.COMPLETED];
const TENANT_STATUSES: BookingStatus[] = [BookingStatus.CANCELLED];

export async function createBooking(tenantId: string, body: unknown) {
    if (!isPlainObject(body)) throw new InvalidDataProvidedError("Body must be a JSON object");

    const listingId = asString(body.listingId);
    const viewingDate = asDate(body.viewingDate);
    if (!listingId || !viewingDate) {
        throw new InvalidDataProvidedError("listingId and a valid viewingDate are required");
    }
    if (viewingDate.getTime() <= Date.now()) {
        throw new InvalidDataProvidedError("viewingDate must be in the future");
    }
    if (body.comment !== undefined && typeof body.comment !== "string") {
        throw new InvalidDataProvidedError("comment must be a string");
    }
    const comment = asString(body.comment);

    // exists (404) -> allowed (403) -> state (409)
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundError("Listing not found");
    if (listing.landlordId === tenantId) throw new ForbiddenError("You cannot book your own listing");
    if (listing.status !== ListingStatus.AVAILABLE) throw new ConflictError("Listing is not available");

    const existing = await prisma.booking.findFirst({
        where: { listingId, tenantId, status: BookingStatus.PENDING },
    });
    if (existing) throw new ConflictError("You already have a pending booking for this listing");

    return prisma.booking.create({
        data: {
            listingId,
            tenantId,
            viewingDate,
            ...(comment !== undefined ? { comment } : {}),
        },
        include: { listing: true },
    });
}

export async function getMyBookings(tenantId: string) {
    return prisma.booking.findMany({
        where: { tenantId },
        include: { listing: true },
        orderBy: { viewingDate: "asc" },
    });
}

// Filter by a field of the RELATED model - one query, Prisma builds the JOIN
export async function getIncomingBookings(landlordId: string) {
    return prisma.booking.findMany({
        where: { listing: { landlordId } },
        include: {
            listing: true,
            tenant: { select: { id: true, email: true, username: true, phone: true } },
        },
        orderBy: { viewingDate: "asc" },
    });
}

export async function updateBookingStatus(bookingId: string, actor: Actor, body: unknown) {
    if (!isPlainObject(body)) throw new InvalidDataProvidedError("Body must be a JSON object");
    const status = asEnum(body.status, BookingStatus);
    if (!status || status === BookingStatus.PENDING) {
        throw new InvalidDataProvidedError("status must be CONFIRMED, CANCELLED or COMPLETED");
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { listing: true } });
    if (!booking) throw new NotFoundError("Booking not found");

    const isAdmin = actor.role === UserRole.ADMIN;
    const isOwner = booking.listing.landlordId === actor.id;
    const isTenant = booking.tenantId === actor.id;

    if (!isAdmin && !isOwner && !isTenant) throw new ForbiddenError("Not your booking");

    const allowed = isAdmin || isOwner ? LANDLORD_STATUSES : TENANT_STATUSES;
    if (!allowed.includes(status)) throw new ForbiddenError(`You cannot set status ${status}`);

    if (FINAL_STATUSES.includes(booking.status)) {
        throw new ConflictError(`Booking is already ${booking.status}`);
    }

    return prisma.booking.update({
        where: { id: bookingId },
        data: { status },
        include: { listing: true },
    });
}
