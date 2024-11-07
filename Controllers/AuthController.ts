import Elysia from "elysia";
import type { HttpServerContext } from "../server";
import APIResponse from "../Classes/APIResponse";
import UserModel from "../Models/UserModel";
import { validatePassword } from "../Utils/Password";
import SessionModel from "../Models/SessionModel";

export const authController = new Elysia({ prefix: "/auth" });

authController.post("/login", async ({ request, server, cookie }: HttpServerContext) => {
	const { username, password } = await request.json();

	const user = await UserModel.findOne({ where: { username } });

	if (!user)
		throw new Error(`Người dùng với username ${username} không tồn tại!`);

	if (!validatePassword(user.password, password))
		throw new Error(`Mật khẩu không chính xác!`);

	user.lastIP = server?.requestIP(request)?.address || "";
	const session = await SessionModel.start(user);
	cookie.Session.value = session.sessionId;
	const response = new APIResponse(0, "Đăng nhập thành công!", 200, session);
	return response;
});

authController.get("/session", async ({ session }: HttpServerContext) => {
	return new APIResponse(0, "Phiên đăng nhập hiện tại", 200, session);
});
