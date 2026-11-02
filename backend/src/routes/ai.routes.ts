import { Router } from "express";
import { search, askListing } from "../controllers/ai.controller";
import { optionalAuth } from "../middleware/auth.middleware";
import { aiRateLimit } from "../middleware/rateLimit.middleware";

const router = Router();

router.post("/search", aiRateLimit, optionalAuth, search);
router.post("/listings/:id/ask", aiRateLimit, askListing);

export default router;
