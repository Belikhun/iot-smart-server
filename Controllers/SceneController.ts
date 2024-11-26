import Elysia from "elysia";
import SceneModel from "../Models/SceneModel";
import SceneActionModel from "../Models/SceneActionModel";
import APIResponse from "../Classes/APIResponse";
import { getScene, getScenes, registerScene } from "../Device/SceneService";
import { getSceneAction, SceneAction } from "../Device/Scenes/SceneAction";
import { satisfySearch } from "../Utils/belibrary";

export const sceneController = new Elysia({ prefix: "/scene" });

sceneController.get("/list", async ({ request, query: { search } }) => {
	const scenes = getScenes();
	const instances = [];

	for (const scene of Object.values(scenes)) {
		if (search) {
			if (!satisfySearch([scene.model.name], search))
				continue;
		}

		instances.push(await scene.getReturnData());
	}

	return new APIResponse(0, `Danh sách các cảnh`, 200, instances);
});

sceneController.post("/create", async ({ request }) => {
	const { name, icon, color } = await request.json();

	const instance = await SceneModel.create({
		name,
		icon,
		color
	});

	const scene = await registerScene(instance);
	return new APIResponse(0, `Đã tạo cảnh`, 200, await scene.getReturnData());
});

sceneController.get("/:id/info", async ({ params: { id }, request }) => {
	const scene = getScene(parseInt(id));

	if (!scene)
		throw new Error(`Không tìm thấy cảnh với mã #${id}`);

	return new APIResponse(0, `Đã cập nhật cảnh`, 200, await scene.getReturnData());
});

sceneController.post("/:id/edit", async ({ params: { id }, request }) => {
	const scene = getScene(parseInt(id));

	if (!scene)
		throw new Error(`Không tìm thấy cảnh với mã #${id}`);

	const { name, icon, color, active } = await request.json();

	scene.model.name = name;
	scene.model.icon = icon;
	scene.model.color = color;
	await scene.model.save();

	return new APIResponse(0, `Đã cập nhật cảnh`, 200, await scene.getReturnData());
});

sceneController.get("/:id/action", async ({ params: { id }, request }) => {
	const scene = getScene(parseInt(id));

	if (!scene)
		throw new Error(`Không tìm thấy cảnh với mã #${id}`);

	const actions = [];

	for (const action of Object.values(scene.actions))
		actions.push(await action.getReturnData());

	return new APIResponse(0, `Các hành động của luật ${scene.model.name}`, 200, actions);
});

sceneController.get("/action/:aid/info", async ({ params: { aid }, request }) => {
	const instance = getSceneAction(parseInt(aid));
	if (!instance)
		throw new Error(`Không tìm thấy hành động với mã #${aid}`);

	return new APIResponse(0, `Thông tin hành động`, 200, await instance.getReturnData());
});

sceneController.post("/:id/action/:aid/edit", async ({ params: { id, aid }, request }) => {
	const scene = getScene(parseInt(id));
	if (!scene)
		throw new Error(`Không tìm thấy cảnh với mã #${id}`);

	const instance = scene.actions[parseInt(aid)];
	if (!instance)
		throw new Error(`Không tìm thấy hành động với mã #${aid}`);

	const { deviceFeature, action, newValue } = await request.json();

	instance.model.deviceFeatureId = deviceFeature;
	instance.model.action = action;
	instance.model.newValue = newValue;
	await instance.model.save();
	instance.load();

	return new APIResponse(0, `Cập nhật thành công!`, 200, await instance.getReturnData());
});

sceneController.delete("/:id/action/:aid/delete", async ({ params: { id, aid }, request }) => {
	const scene = getScene(parseInt(id));
	if (!scene)
		throw new Error(`Không tìm thấy cảnh với mã #${id}`);

	const instance = scene.actions[parseInt(aid)];
	if (!instance)
		throw new Error(`Không tìm thấy hành động với mã #${aid}`);

	await instance.delete();
	return new APIResponse(0, `Xóa bỏ thành công!`, 200);
});

sceneController.post("/:id/action/create", async ({ params: { id }, request }) => {
	const scene = getScene(parseInt(id));
	if (!scene)
		throw new Error(`Không tìm thấy cảnh với mã #${id}`);

	const { deviceFeatureId, action, newValue } = await request.json();

	const instance = await SceneAction.create({
		scene,
		deviceFeatureId,
		action,
		newValue
	});

	return new APIResponse(0, `Tạo điều kiện mới thành công!`, 200, await instance.getReturnData());
});

sceneController.post("/:id/execute", async ({ params: { id }, request }) => {
	const scene = getScene(parseInt(id));
	if (!scene)
		throw new Error(`Không tìm thấy cảnh với mã #${id}`);

	scene.execute();
	return new APIResponse(0, `Chạy thành công!`, 200);
});
