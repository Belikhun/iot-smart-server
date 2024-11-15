import Elysia from "elysia";
import APIResponse from "../Classes/APIResponse";
import { getTrigger, getTriggers, registerTrigger } from "../Device/TriggerService";
import TriggerModel from "../Models/TriggerModel";

export const triggerController = new Elysia({ prefix: "/trigger" });

triggerController.get("/list", async ({ request }) => {
	const triggers = getTriggers();
	const instances = [];

	for (const device of Object.values(triggers))
		instances.push(await device.getReturnData());

	return new APIResponse(0, `Danh sách các luật kích hoạt`, 200, instances);
});

triggerController.post("/create", async ({ request }) => {
	const { name, icon, color, active } = await request.json();

	const instance = await TriggerModel.create({
		name,
		icon,
		color,
		active
	});

	const trigger = await registerTrigger(instance);
	return new APIResponse(0, `Đã tạo luật kích hoạt`, 200, trigger.getReturnData());
});

triggerController.post("/:id/edit", async ({ params: { id }, request }) => {
	const trigger = getTrigger(parseInt(id));

	if (!trigger)
		throw new Error(`Không tìm thấy luật kích hoạt với mã #${id}`);

	const { name, icon, color, active } = await request.json();

	trigger.model.name = name;
	trigger.model.icon = icon;
	trigger.model.color = color;
	trigger.model.active = active;
	await trigger.model.save();

	return new APIResponse(0, `Đã cập nhật luật kích hoạt`, 200, trigger.getReturnData());
});
