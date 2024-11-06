import User from "../Models/User";

export const getAllUsers = async (request: Request): Promise<Response> => {
	try {
		const users = await User.findAll();
		return new Response(JSON.stringify(users), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: "Failed to fetch users" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
