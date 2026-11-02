import { Request, Response, NextFunction } from "express";
import { aiSearch, askAboutListing } from "../services/ai.service";

export const search = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // req.user is set only if the client sent a valid token (optionalAuth)
        const result = await aiSearch(req.body, req.user?.id);
        return res.json(result);
    } catch (error) {
        next(error);
    }
};

export const askListing = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await askAboutListing(String(req.params.id), req.body);
        return res.json(result);
    } catch (error) {
        next(error);
    }
};
