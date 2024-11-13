import Elysia from "elysia";
import APIResponse from "../Classes/APIResponse";
import { getDevices } from "../Device/Device";

export const deviceController = new Elysia({ prefix: "/device" });

deviceController.get("/list", async ({ request }) => {
	const devices = getDevices();
	const instances = [];

	for (const device of Object.values(devices)) {
		instances.push({
			...device.model.dataValues,
			connected: device.connected,
			address: device.websocket?.remoteAddress
		});
	}

	return new APIResponse(0, `Danh sách các thiết bị`, 200, instances);
});
