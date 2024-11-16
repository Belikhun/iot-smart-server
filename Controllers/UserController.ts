import Elysia, { redirect } from "elysia";
import UserModel from "../Models/UserModel";
import { hashPassword } from "../Utils/Password";
import APIResponse from "../Classes/APIResponse";
import { createHash } from "crypto";
import SessionModel from "../Models/SessionModel";

export const userController = new Elysia({ prefix: "/user" });

userController.post("/create", async ({ request }) => {
	const { username, name, email, password, isAdmin } = await request.json();

	const existingUser = await UserModel.findOne({ where: { username } });

	if (existingUser)
		throw new Error(`Người dùng với username ${username} đã tồn tại!`);

	const instance = UserModel.build({
		username,
		name,
		email,
		password: await hashPassword(password),
		isAdmin
	});

	await instance.save();
	return new APIResponse(0, `Tạo người dùng thành công!`, 200, await instance.getReturnData());
});

userController.post("/:id/edit", async ({ params: { id }, request }) => {
	const instance = await UserModel.findOne({ where: { id } });

	if (!instance)
		return new APIResponse(1, "Tài khoản không tồn tại!", 404);

	const { name, email, password, isAdmin } = await request.json();

	instance.name = name;
	instance.email = email;
	instance.isAdmin = isAdmin;

	if (password)
		instance.password = await hashPassword(password);

	await instance.save();
	return new APIResponse(0, `Cập nhật thông tin người dùng thành công!`, 200, await instance.getReturnData());
});

userController.post("/:id/sessions", async ({ params: { id }, request }) => {
	const instances = await SessionModel.findAll({
		where: { userId: id },
		order: [["id", "DESC"]]
	});

	const data = [];

	for (const instance of instances)
		data.push(await instance.getReturnData());

	return new APIResponse(0, `Lấy thông tin phiên thành công!`, 200, data);
});

userController.delete("/:id/delete", async ({ params: { id }, request }) => {
	await SessionModel.destroy({
		where: { userId: id },
		force: true
	});

	await UserModel.destroy({
		where: { id },
		force: true
	});

	return new APIResponse(0, `Xóa người dùng thành công!`, 200);
});

userController.get("/list", async ({ request }) => {
	const users = await UserModel.findAll({
		order: [["id", "DESC"]]
	});

	const data = [];

	for (const user of users)
		data.push(await user.getReturnData());

	return new APIResponse(0, `Danh sách người dùng trong hệ thống`, 200, data);
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
