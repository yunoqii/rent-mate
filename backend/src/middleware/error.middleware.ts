import { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";

// Catch-all for unknown routes, so the API answers JSON instead of Express's HTML page
export const notFoundHandler = (_req: Request, res: Response) => {
    res.status(404).json({ message: "Route not found" });
};

// Express recognises an error handler by its 4 arguments - do not remove _next!
export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
    }

    // Broken JSON body from express.json()
    if (error instanceof SyntaxError && "body" in error) {
        return res.status(400).json({ message: "Malformed JSON body" });
    }

    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
};
