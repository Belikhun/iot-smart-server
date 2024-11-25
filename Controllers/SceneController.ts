import Elysia from "elysia";
import SceneModel from "../Models/SceneModel";
import SceneActionModel from "../Models/SceneActionModel";
import APIResponse from "../Classes/APIResponse";

export const sceneController = new Elysia({ prefix: "/scene" });

/**
 * Scene CRUD operations
 */
sceneController.post("/create", async ({ request }) => {
	const { name, icon, color } = await request.json();

	const instance = SceneModel.build({
		name,
		icon,
		color,
	});

	await instance.save();
	return new APIResponse(0, `Tạo scene thành công!`, 200, instance);
});

sceneController.post("/:id/edit", async ({ params: { id }, request }) => {
	const instance = await SceneModel.findOne({ where: { id } });

	if (!instance)
		return new APIResponse(1, "Scene không tồn tại!", 404);

	const { name, icon, color } = await request.json();

	instance.name = name;
	instance.icon = icon;
	instance.color = color;

	await instance.save();
	return new APIResponse(0, `Cập nhật scene thành công!`, 200, instance);
});

sceneController.get("/list", async () => {
	const scenes = await SceneModel.findAll({
		order: [["id", "DESC"]],
	});

	return new APIResponse(0, `Danh sách scenes trong hệ thống`, 200, scenes);
});

sceneController.delete("/:id/delete", async ({ params: { id } }) => {
	await SceneModel.destroy({
		where: { id },
		force: true,
	});

	return new APIResponse(0, `Xóa scene thành công!`, 200);
});

/**
 * Scene Actions CRUD operations
 */
sceneController.post("/:id/action/create", async ({ params: { id }, request }) => {
	const { deviceFeature, action, newValue } = await request.json();

	const instance = SceneActionModel.build({
		sceneId: parseInt(id),
		deviceFeatureId: deviceFeature,
		action,
		newValue,
	});

	await instance.save();
	return new APIResponse(0, `Tạo action cho scene thành công!`, 200, instance);
});

sceneController.post("/:id/action/:actionId/edit", async ({ params: { id, actionId }, request }) => {
	const instance = await SceneActionModel.findOne({
		where: { sceneId: id, id: actionId },
	});

	if (!instance)
		return new APIResponse(1, "Action không tồn tại!", 404);

	const { deviceFeature, action, newValue } = await request.json();

	instance.deviceFeatureId = deviceFeature;
	instance.action = action;
	instance.newValue = newValue;

	await instance.save();
	return new APIResponse(0, `Cập nhật action thành công!`, 200, instance);
});

sceneController.get("/:id/action/list", async ({ params: { id } }) => {
	const actions = await SceneActionModel.findAll({
		where: { sceneId: id },
		order: [["id", "DESC"]],
	});

	return new APIResponse(0, `Danh sách actions cho scene`, 200, actions);
});

sceneController.delete("/:id/action/:actionId/delete", async ({ params: { id, actionId } }) => {
	await SceneActionModel.destroy({
		where: { id: actionId, sceneId: id },
		force: true,
	});

	return new APIResponse(0, `Xóa action thành công!`, 200);
});
