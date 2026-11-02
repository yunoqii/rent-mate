import { Router } from "express";
import { getMyPreferences, putMyPreferences } from "../controllers/preferences.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { UserRole } from "../generated/prisma/enums";

const router = Router();

// "/me" instead of "/:userId" - nothing in the URL to tamper with (anti-IDOR)
router.get("/me", requireAuth, requireRole(UserRole.TENANT, UserRole.ADMIN), getMyPreferences);
router.put("/me", requireAuth, requireRole(UserRole.TENANT, UserRole.ADMIN), putMyPreferences);

export default router;
