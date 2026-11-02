// Fills the database with deterministic test data: npm run seed
// WARNING: deletes all existing users, listings, preferences and bookings first.
import bcrypt from "bcrypt";
import prisma from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
import { PropertyType, ListingStatus, UserRole, BookingStatus } from "../generated/prisma/enums";

// Pseudo-random number 0..1 from an index: looks random, but is the same on every run
function rand(seed: number): number {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

const CITIES = [
    { name: "Wrocław", lat: 51.1079, lng: 17.0385, neighborhoods: ["Stare Miasto", "Krzyki", "Nadodrze", "Śródmieście", "Fabryczna"] },
    { name: "Poznań", lat: 52.4064, lng: 16.9252, neighborhoods: ["Jeżyce", "Łazarz", "Wilda", "Grunwald", "Stare Miasto"] },
    { name: "Kraków", lat: 50.0647, lng: 19.945, neighborhoods: ["Kazimierz", "Podgórze", "Krowodrza", "Nowa Huta", "Stare Miasto"] },
];

const STREETS = ["Długa", "Polna", "Ogrodowa", "Lipowa", "Słoneczna", "Kwiatowa", "Leśna", "Szkolna"];
const TYPES = [PropertyType.APARTMENT, PropertyType.APARTMENT, PropertyType.STUDIO, PropertyType.ROOM, PropertyType.APARTMENT, PropertyType.HOUSE];

const DESCRIPTIONS: Record<PropertyType, string> = {
    APARTMENT: "Bright apartment in a well-kept building, close to public transport and shops.",
    STUDIO: "Compact studio, perfect for one person. Kitchen annex, modern bathroom.",
    ROOM: "Room in a shared flat with friendly flatmates. Shared kitchen and bathroom.",
    HOUSE: "Detached house with a small garden, quiet area, good for a family or pets.",
};

function buildListing(i: number, landlordId: string): Prisma.ListingCreateManyInput {
    const city = CITIES[i % CITIES.length]!;
    const type = TYPES[i % TYPES.length]!;
    const neighborhood = city.neighborhoods[Math.floor(rand(i + 1) * city.neighborhoods.length)]!;

    const rooms = type === PropertyType.ROOM || type === PropertyType.STUDIO ? 1 : 1 + Math.floor(rand(i + 2) * 4);
    const area = Math.round(type === PropertyType.ROOM ? 10 + rand(i + 3) * 10 : 20 + rooms * 14 + rand(i + 3) * 20);
    const basePrice = type === PropertyType.ROOM ? 900 : 1500 + rooms * 650;
    const price = Math.round((basePrice + rand(i + 4) * 1000) / 50) * 50;

    const pets = rand(i + 5) > 0.55 || type === PropertyType.HOUSE;
    const remote = rand(i + 9) > 0.5;
    const isHouse = type === PropertyType.HOUSE;
    const totalFloors = isHouse ? null : 3 + Math.floor(rand(i + 6) * 8);

    return {
        title: `${type === PropertyType.ROOM ? "Room" : `${rooms}-room ${type.toLowerCase()}`} in ${neighborhood}, ${city.name}`,
        description: DESCRIPTIONS[type] + (pets ? " Pets welcome." : "") + (remote ? " Fast fibre internet and a desk - great for remote work." : ""),
        propertyType: type,
        city: city.name,
        neighborhood,
        address: `ul. ${STREETS[i % STREETS.length]} ${1 + (i * 7) % 60}`,
        price,
        // Every 5th listing has no deposit at all (null, not 0)
        depositAmount: i % 5 === 0 ? null : price,
        area,
        rooms,
        floor: totalFloors === null ? null : Math.floor(rand(i + 7) * totalFloors),
        totalFloors,
        latitude: city.lat + (rand(i + 10) - 0.5) * 0.08,
        longitude: city.lng + (rand(i + 11) - 0.5) * 0.12,
        furnished: rand(i + 12) > 0.3,
        hasElevator: totalFloors !== null && totalFloors > 4,
        hasParking: rand(i + 13) > 0.6,
        hasBalcony: !isHouse && rand(i + 14) > 0.5,
        utilitiesIncluded: type === PropertyType.ROOM || rand(i + 15) > 0.7,
        petsAllowed: pets,
        smokingAllowed: rand(i + 16) > 0.85,
        requiresIncomeProof: rand(i + 17) > 0.6,
        remoteWorkFriendly: remote,
        maxOccupants: type === PropertyType.ROOM ? 1 : rooms + 1,
        minLeaseMonths: [null, 6, 12, 12][i % 4] ?? null,
        availableFrom: i % 3 === 0 ? null : new Date(Date.UTC(2026, 10 + (i % 3), 1)),
        // Two rented listings, to check that search hides them
        status: i === 7 || i === 23 ? ListingStatus.RENTED : ListingStatus.AVAILABLE,
        landlordId,
    };
}

async function main() {
    // Delete from "leaves" to "roots" because of foreign keys
    await prisma.booking.deleteMany();
    await prisma.preferences.deleteMany();
    await prisma.listing.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash("password123", 10);
    const [landlord1, landlord2, tenant] = await Promise.all([
        prisma.user.create({ data: { email: "landlord1@rentmate.dev", passwordHash, role: UserRole.LANDLORD, username: "anna_landlord" } }),
        prisma.user.create({ data: { email: "landlord2@rentmate.dev", passwordHash, role: UserRole.LANDLORD, username: "marek_landlord" } }),
        prisma.user.create({ data: { email: "tenant@rentmate.dev", passwordHash, role: UserRole.TENANT, username: "zhenia" } }),
        prisma.user.create({ data: { email: "admin@rentmate.dev", passwordHash, role: UserRole.ADMIN } }),
    ]);

    const data = Array.from({ length: 42 }, (_, i) => buildListing(i, i % 2 === 0 ? landlord1.id : landlord2.id));
    // One INSERT instead of 42 round-trips
    await prisma.listing.createMany({ data });

    await prisma.preferences.create({
        data: {
            userId: tenant.id,
            desiredCity: "Poznań",
            desiredPropertyType: PropertyType.APARTMENT,
            maxPrice: 3500,
            minRooms: 2,
            wantsPetsAllowed: true,
            wantsRemoteWork: true,
            moveInDate: new Date(Date.UTC(2026, 11, 1)),
        },
    });

    // createMany does not return rows, so we read a couple back for bookings
    const someListings = await prisma.listing.findMany({ where: { status: ListingStatus.AVAILABLE }, take: 2, orderBy: { title: "asc" } });
    const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    for (const [index, listing] of someListings.entries()) {
        await prisma.booking.create({
            data: {
                listingId: listing.id,
                tenantId: tenant.id,
                viewingDate: new Date(inAWeek.getTime() + index * 24 * 60 * 60 * 1000),
                comment: index === 0 ? "I have a small dog, is that OK?" : null,
                status: index === 0 ? BookingStatus.PENDING : BookingStatus.CONFIRMED,
            },
        });
    }

    console.log(`Seeded: 4 users, ${data.length} listings, 1 preferences profile, ${someListings.length} bookings`);
    console.log("Login with tenant@rentmate.dev / landlord1@rentmate.dev / admin@rentmate.dev, password: password123");
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1; // non-zero, so `&&` and CI see the failure
    })
    .finally(() => prisma.$disconnect());
