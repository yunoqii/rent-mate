import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { registerUser } from "../services/auth.service";
import { AppError } from "../lib/errors";

export const register = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        const user = await registerUser(email, password);
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: "1h" });
        return res.json({ token });
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
