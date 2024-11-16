import Elysia from "elysia";
import APIResponse from "../Classes/APIResponse";
import { getDevice, getDeviceById, getDevices } from "../Device/Device";

export const deviceController = new Elysia({ prefix: "/device" });

deviceController.get("/list", async ({ request }) => {
	const devices = getDevices();
	const instances = [];

	for (const device of Object.values(devices))
		instances.push(await device.getReturnData());

	return new APIResponse(0, `Danh sách các thiết bị`, 200, instances);
});

deviceController.post("/:id/edit", async ({ params: { id }, request }) => {
	const instance = getDeviceById(parseInt(id));

	if (!instance)
		throw new Error(`Thiết bị với mã #${id} không tồn tại!`);

	const { name, icon, color, tags, area } = await request.json();

	instance.model.name = name;
	instance.model.icon = icon;
	instance.model.color = color;
	instance.model.tags = (tags) ? tags.join(";") : "";
	instance.model.area = area;
	await instance.model.save();

	return new APIResponse(0, `Danh sách các thiết bị`, 200, await instance.getReturnData());
});

deviceController.get("/:hardwareId/info", async ({ params: { hardwareId }, request }) => {
	const device = getDevice(hardwareId);
	return new APIResponse(0, `Thiết bị ${hardwareId}`, 200, await device?.getReturnData());
});
