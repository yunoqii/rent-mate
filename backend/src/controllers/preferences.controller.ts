import { Request, Response, NextFunction } from "express";
import { getPreferences, upsertPreferences } from "../services/preferences.service";
import { serializePreferences } from "../lib/serialize";

export const getMyPreferences = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const preferences = await getPreferences(req.user!.id);
        return res.json(serializePreferences(preferences));
    } catch (error) {
        next(error);
    }
};

export const putMyPreferences = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // userId from the token - a userId in the body is simply never read
        const preferences = await upsertPreferences(req.user!.id, req.body);
        return res.json(serializePreferences(preferences));
    } catch (error) {
        next(error);
    }
};
