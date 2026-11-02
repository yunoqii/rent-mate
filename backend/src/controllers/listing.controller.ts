import { Request, Response, NextFunction } from "express";
import * as listingService from "../services/listing.service";
import { findPreferences } from "../services/preferences.service";
import { rankListings } from "../services/ranking.service";
import { serializeListing } from "../lib/serialize";

// Express 5 types params as string | string[]; our routes always give a string
const idParam = (req: Request) => String(req.params.id);

export const getListings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = req.query as Record<string, unknown>;
        const filters = listingService.parseListingFilters(query);
        const result = await listingService.searchListings(filters, listingService.parsePagination(query));
        return res.json({ ...result, items: result.items.map(serializeListing) });
    } catch (error) {
        next(error);
    }
};

// Listings ranked against the logged-in tenant's preferences (same filters as GET /listings)
export const getRecommended = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters = listingService.parseListingFilters(req.query as Record<string, unknown>);
        const listings = await listingService.findListingsForRanking(filters);
        const preferences = await findPreferences(req.user!.id);
        const ranked = rankListings(listings, preferences).slice(0, 20);
        return res.json({
            personalized: preferences !== null,
            results: ranked.map((item) => ({ ...item, listing: serializeListing(item.listing) })),
        });
    } catch (error) {
        next(error);
    }
};

export const getMyListings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const listings = await listingService.getListingsByLandlord(req.user!.id);
        return res.json(listings.map(serializeListing));
    } catch (error) {
        next(error);
    }
};

export const getListing = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const listing = await listingService.getListingById(idParam(req));
        return res.json(serializeListing(listing));
    } catch (error) {
        next(error);
    }
};

export const createListing = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // landlordId comes ONLY from the token, never from the body
        const listing = await listingService.createListing(req.user!.id, req.body);
        return res.status(201).json(serializeListing(listing));
    } catch (error) {
        next(error);
    }
};

export const updateListing = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const listing = await listingService.updateListing(idParam(req), req.user!, req.body);
        return res.json(serializeListing(listing));
    } catch (error) {
        next(error);
    }
};

export const deleteListing = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await listingService.deleteListing(idParam(req), req.user!);
        return res.status(204).send();
    } catch (error) {
        next(error);
    }
};
