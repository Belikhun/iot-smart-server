import { getAllUsers } from "../Controllers/UserController";

export default async function userRoutes(request: Request): Promise<Response> {
	const url = new URL(request.url);

	if (url.pathname === "/api/users" && request.method === "GET") {
		return await getAllUsers(request);
	}

	return new Response("Not Found", { status: 404 });
}
