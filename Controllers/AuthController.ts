import Elysia from "elysia";
import type { HttpServerContext } from "../server";
import APIResponse from "../Classes/APIResponse";
import UserModel from "../Models/UserModel";
import { validatePassword } from "../Utils/Password";
import SessionModel from "../Models/SessionModel";
import { time } from "../Utils/belibrary";

export const authController = new Elysia({ prefix: "/auth" });

authController.post("/login", async ({ request, server, cookie }: HttpServerContext) => {
	const { username, password } = await request.json();

	const user = await UserModel.findOne({ where: { username } });

	if (!user)
		return new APIResponse(1, "Tài khoản không tồn tại!", 404);

	if (!(await validatePassword(user.password, password)))
		return new APIResponse(2, "Mật khẩu không chính xác!", 403);

	user.lastIP = server?.requestIP(request)?.address || "";
	user.lastAccess = time();
	const session = await SessionModel.start(user);
	cookie.Session.value = session.sessionId;
	await user.save();

	return new APIResponse(0, "Đăng nhập thành công!", 200, await session.getReturnData());
});

authController.post("/logout", async ({ session }: HttpServerContext) => {
	await session?.invalidate();
	return new APIResponse(0, "Đăng xuất thành công!", 200);
});

authController.get("/session", async ({ session }: HttpServerContext) => {
	return new APIResponse(0, "Phiên đăng nhập hiện tại", 200, await session?.getReturnData());
});

authController.get("/hello", async ({ session }: HttpServerContext) => {
	return new APIResponse(0, "Hello!", 200);
});
