import Elysia, { redirect } from "elysia";
import UserModel from "../Models/UserModel";
import { hashPassword } from "../Utils/Password";
import APIResponse from "../Classes/APIResponse";
import { createHash } from "crypto";

export const userController = new Elysia({ prefix: "/user" });

userController.post("/create", async ({ request }) => {
	const { username, name, email, password } = await request.json();

	const existingUser = await UserModel.findOne({ where: { username } });

	if (existingUser)
		throw new Error(`Người dùng với username ${username} đã tồn tại!`);

	const instance = UserModel.build({
		username,
		name,
		email,
		password: await hashPassword(password),
		isAdmin: false
	});

	await instance.save();
	return new APIResponse(0, `Tạo user thành công!`, 200, instance);
});

userController.get("/:username/avatar", async ({ request, params: { username } }) => {
	const user = await UserModel.findOne({ where: { username } });
	const email = (user)
		? user.email
		: "admin@localhost.io";

	const hash = createHash("sha256").update(email).digest("hex");
	const url = `https://gravatar.com/avatar/${hash}?d=identicon`;
	return redirect(url);
});
