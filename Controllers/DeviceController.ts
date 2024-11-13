import Elysia from "elysia";
import APIResponse from "../Classes/APIResponse";
import { getDevice, getDevices } from "../Device/Device";

export const deviceController = new Elysia({ prefix: "/device" });

deviceController.get("/list", async ({ request }) => {
	const devices = getDevices();
	const instances = [];

	for (const device of Object.values(devices))
		instances.push(await device.getReturnData());

	return new APIResponse(0, `Danh sách các thiết bị`, 200, instances);
});

deviceController.get("/:hardwareId/info", async ({ params: { hardwareId }, request }) => {
	const device = getDevice(hardwareId);
	return new APIResponse(0, `Thiết bị ${hardwareId}`, 200, await device?.getReturnData());
});