import { Request, Response, NextFunction } from "express";
import * as bookingService from "../services/booking.service";
import { serializeBooking } from "../lib/serialize";

export const createBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const booking = await bookingService.createBooking(req.user!.id, req.body);
        return res.status(201).json(serializeBooking(booking));
    } catch (error) {
        next(error);
    }
};

export const getMyBookings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const bookings = await bookingService.getMyBookings(req.user!.id);
        return res.json(bookings.map(serializeBooking));
    } catch (error) {
        next(error);
    }
};

export const getIncomingBookings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const bookings = await bookingService.getIncomingBookings(req.user!.id);
        return res.json(bookings.map(serializeBooking));
    } catch (error) {
        next(error);
    }
};

export const updateBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const booking = await bookingService.updateBookingStatus(String(req.params.id), req.user!, req.body);
        return res.json(serializeBooking(booking));
    } catch (error) {
        next(error);
    }
};
