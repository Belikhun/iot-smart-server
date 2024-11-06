import { serve } from "bun";
import userRoutes from "./Routes/UserRoutes";
import { sequelize } from "./Config/Database";

// Bun JSON middleware for TypeScript support
async function jsonMiddleware(req: Request): Promise<any> {
	const body = await req.text();
	return body ? JSON.parse(body) : {};
}

serve({
	fetch: async (req: Request) => {
		return await userRoutes(req);
	},

	port: 3000,
	development: true
});

// Database connection
sequelize.authenticate()
	.then(() => console.log("Database connected"))
	.catch((err: Error) => console.error("Unable to connect to the database:", err));

console.log("Server running at http://localhost:3000");
