import { Router } from "express";
import * as listing from "../controllers/listing.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { UserRole } from "../generated/prisma/enums";

const router = Router();

// Static paths BEFORE "/:id", otherwise "recommended" is taken as an id
router.get("/", listing.getListings);
router.get("/recommended", requireAuth, requireRole(UserRole.TENANT, UserRole.ADMIN), listing.getRecommended);
router.get("/mine", requireAuth, requireRole(UserRole.LANDLORD, UserRole.ADMIN), listing.getMyListings);
router.get("/:id", listing.getListing);

router.post("/", requireAuth, requireRole(UserRole.LANDLORD, UserRole.ADMIN), listing.createListing);
// Ownership (is it YOUR listing) is checked in the service
router.patch("/:id", requireAuth, listing.updateListing);
router.delete("/:id", requireAuth, listing.deleteListing);

export default router;
