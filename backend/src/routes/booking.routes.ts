import { Router } from "express";
import * as booking from "../controllers/booking.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { UserRole } from "../generated/prisma/enums";

const router = Router();

router.post("/", requireAuth, requireRole(UserRole.TENANT, UserRole.ADMIN), booking.createBooking);
router.get("/my", requireAuth, requireRole(UserRole.TENANT, UserRole.ADMIN), booking.getMyBookings);
router.get("/incoming", requireAuth, requireRole(UserRole.LANDLORD, UserRole.ADMIN), booking.getIncomingBookings);
// Who may set which status is decided in the service (needs the booking from the DB)
router.patch("/:id", requireAuth, booking.updateBooking);

export default router;
