import Elysia from "elysia";
import User from "../Models/User";
import { hashPassword } from "../Utils/Password";
import APIResponse from "../Classes/APIResponse";

export const userController = new Elysia({ prefix: "/user" });

userController.post("/create", async ({ request }) => {
	const { username, email, password } = await request.json();

	let existingUser = await User.findOne({ where: { username } });

	if (existingUser)
		throw new Error(`Người dùng với username ${username} đã tồn tại!`);

	const instance = User.build({
		username,
		email,
		password: await hashPassword(password),
		isAdmin: false
	});

	await instance.save();
	return new APIResponse(0, `Tạo user thành công!`, 200, instance);
});