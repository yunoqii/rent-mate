import express from "express";
import "dotenv/config";
import prisma from "./lib/prisma";

const app = express();

app.get("/health", (req, res) => {
    return res.status(200).send("OK");
})

app.get("/health/db", async (req, res) => {
    try {
        const result = await prisma.user.count();
        return res.status(200).send(`OK - ${result} users found`);
    } catch (error) {
        console.error(error);
        return res.status(500).send("Database connection failed");
    }
});

app.listen(Number(process.env.PORT), () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});

