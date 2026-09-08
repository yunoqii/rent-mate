import express from "express";
import "dotenv/config";

import AuthRoutes from "./routes/auth.routes"

const app = express();

app.use(express.json());

app.use("/auth", AuthRoutes);



// app.get("/health", (req, res) => {
//     return res.status(200).send("OK");
// })

// app.get("/health/db", async (req, res) => {
//     try {
//         const result = await prisma.user.count();
//         return res.status(200).send(`OK - ${result} users found`);
//     } catch (error) {
//         console.error(error);
//         return res.status(500).send("Database connection failed");
//     }
// });

app.listen(Number(process.env.PORT), () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});

