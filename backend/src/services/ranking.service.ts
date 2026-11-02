import type { Listing, Preferences } from "../generated/prisma/client";

// Heuristic ranking of listings against a tenant's preferences.
// Every criterion the tenant filled in adds "possible points"; a matching listing earns them.
// Final score = earned / possible * 100, so a sparse profile isn't punished.
// Hard conflicts (wants pets, pets forbidden) push the score down instead of hiding the listing:
// the user still sees it, just lower, with an explanation.

export type RankedListing = {
    listing: Listing;
    score: number;      // 0..100
    reasons: string[];  // why it matches
    warnings: string[]; // why it may not fit
};

export function scoreListing(listing: Listing, prefs: Preferences): RankedListing {
    let earned = 0;
    let possible = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];

    const price = listing.price.toNumber();
    const maxPrice = prefs.maxPrice?.toNumber() ?? null;
    const minPrice = prefs.minPrice?.toNumber() ?? null;

    // Budget is the most important criterion
    if (maxPrice !== null) {
        possible += 30;
        if (price <= maxPrice) {
            earned += 30;
            reasons.push("Within your budget");
        } else {
            // Partial points if slightly over budget (up to 15% over)
            const over = (price - maxPrice) / maxPrice;
            if (over <= 0.15) {
                earned += Math.round(30 * (1 - over / 0.15) * 0.5);
                warnings.push(`${Math.round(over * 100)}% over your budget`);
            } else {
                warnings.push("Well over your budget");
            }
        }
    }
    if (minPrice !== null && price < minPrice) {
        // Not a penalty, just a note: cheaper than expected
        reasons.push("Cheaper than your minimum price");
    }

    if (prefs.desiredCity) {
        possible += 20;
        if (listing.city.toLowerCase() === prefs.desiredCity.toLowerCase()) {
            earned += 20;
            reasons.push(`In ${listing.city}`);
        } else {
            warnings.push(`In ${listing.city}, not ${prefs.desiredCity}`);
        }
    }

    if (prefs.desiredNeighborhood) {
        possible += 10;
        if (listing.neighborhood?.toLowerCase().includes(prefs.desiredNeighborhood.toLowerCase())) {
            earned += 10;
            reasons.push(`In your neighborhood (${listing.neighborhood})`);
        }
    }

    if (prefs.desiredPropertyType) {
        possible += 10;
        if (listing.propertyType === prefs.desiredPropertyType) {
            earned += 10;
            reasons.push(`Property type: ${listing.propertyType.toLowerCase()}`);
        }
    }

    if (prefs.minArea !== null || prefs.maxArea !== null) {
        possible += 10;
        const fitsMin = prefs.minArea === null || listing.area >= prefs.minArea;
        const fitsMax = prefs.maxArea === null || listing.area <= prefs.maxArea;
        if (fitsMin && fitsMax) {
            earned += 10;
            reasons.push(`${listing.area} m² fits your size range`);
        } else if (!fitsMin) {
            warnings.push(`Smaller than you want (${listing.area} m²)`);
        }
    }

    if (prefs.minRooms !== null) {
        possible += 10;
        if (listing.rooms >= prefs.minRooms) {
            earned += 10;
        } else {
            warnings.push(`Only ${listing.rooms} room(s)`);
        }
    }

    // Non-standard criteria - the main point of the project
    if (prefs.wantsPetsAllowed) {
        possible += 20;
        if (listing.petsAllowed) {
            earned += 20;
            reasons.push("Pets allowed");
        } else {
            earned -= 20; // hard conflict
            warnings.push("Pets are not allowed");
        }
    }
    if (prefs.wantsSmokingAllowed) {
        possible += 10;
        if (listing.smokingAllowed) {
            earned += 10;
            reasons.push("Smoking allowed");
        } else {
            earned -= 10;
            warnings.push("Smoking is not allowed");
        }
    }
    if (prefs.wantsRemoteWork) {
        possible += 15;
        if (listing.remoteWorkFriendly) {
            earned += 15;
            reasons.push("Good for remote work");
        }
    }

    if (prefs.moveInDate) {
        possible += 10;
        if (!listing.availableFrom || listing.availableFrom <= prefs.moveInDate) {
            earned += 10;
            reasons.push("Available by your move-in date");
        } else {
            warnings.push(`Available only from ${listing.availableFrom.toISOString().slice(0, 10)}`);
        }
    }

    // Empty profile -> neutral score
    const score = possible === 0 ? 50 : Math.max(0, Math.min(100, Math.round((earned / possible) * 100)));
    return { listing, score, reasons, warnings };
}

export function rankListings(listings: Listing[], prefs: Preferences | null): RankedListing[] {
    if (!prefs) {
        return listings.map((listing) => ({ listing, score: 50, reasons: [], warnings: [] }));
    }
    return listings
        .map((listing) => scoreListing(listing, prefs))
        .sort((a, b) => b.score - a.score);
}
