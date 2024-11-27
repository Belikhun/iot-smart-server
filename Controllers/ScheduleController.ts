import Elysia from "elysia";
import APIResponse from "../Classes/APIResponse";
import { getSchedule, getSchedules, registerSchedule } from "../Device/ScheduleService";
import ScheduleModel from "../Models/ScheduleModel";
import { ScheduleAction } from "../Device/Schedules/ScheduleAction";
import * as cron from "cron";

export const scheduleController = new Elysia({ prefix: "/schedule" });

scheduleController.get("/list", async ({ request }) => {
	const schedules = getSchedules();
	const instances = [];

	for (const device of Object.values(schedules))
		instances.push(await device.getReturnData());

	return new APIResponse(0, `Danh sách các lịch điều khiển`, 200, instances);
});

scheduleController.post("/create", async ({ request }) => {
	const { name, icon, color, executeAmount, active } = await request.json();

	const instance = await ScheduleModel.create({
		name,
		icon,
		color,
		executeAmount: parseInt(executeAmount),
		active
	});

	const schedule = await registerSchedule(instance);
	return new APIResponse(0, `Đã tạo lịch điều khiển`, 200, await schedule.getReturnData());
});

scheduleController.post("/:id/edit", async ({ params: { id }, request }) => {
	const schedule = getSchedule(parseInt(id));

	if (!schedule)
		throw new Error(`Không tìm thấy lịch điều khiển với mã #${id}`);

	const { name, icon, color, cronExpression, executeAmount, active } = await request.json();

	schedule.model.name = name;
	schedule.model.icon = icon;
	schedule.model.color = color;
	schedule.model.cronExpression = cronExpression;
	schedule.model.executeAmount = parseInt(executeAmount);
	schedule.model.active = active;
	await schedule.model.save();

	// Restart the Cron Job.
	schedule.start();

	return new APIResponse(0, `Đã cập nhật lịch điều khiển`, 200, await schedule.getReturnData());
});

scheduleController.get("/:id/action", async ({ params: { id }, request }) => {
	const schedule = getSchedule(parseInt(id));

	if (!schedule)
		throw new Error(`Không tìm thấy lịch điều khiển với mã #${id}`);

	const actions = [];

	for (const action of Object.values(schedule.actions))
		actions.push(await action.getReturnData());

	return new APIResponse(0, `Các hành động của luật ${schedule.model.name}`, 200, actions);
});

scheduleController.post("/:id/action/:aid/edit", async ({ params: { id, aid }, request }) => {
	const schedule = getSchedule(parseInt(id));
	if (!schedule)
		throw new Error(`Không tìm thấy lịch điều khiển với mã #${id}`);

	const instance = schedule.actions[parseInt(aid)];
	if (!instance)
		throw new Error(`Không tìm thấy hành động với mã #${aid}`);

	const { targetId, targetKind, action, newValue } = await request.json();

	instance.model.targetId = targetId;
	instance.model.targetKind = targetKind;
	instance.model.action = action;
	instance.model.newValue = newValue;
	await instance.model.save();
	instance.load();

	return new APIResponse(0, `Cập nhật thành công!`, 200, await instance.getReturnData());
});

scheduleController.delete("/:id/action/:aid/delete", async ({ params: { id, aid }, request }) => {
	const schedule = getSchedule(parseInt(id));
	if (!schedule)
		throw new Error(`Không tìm thấy lịch điều khiển với mã #${id}`);

	const instance = schedule.actions[parseInt(aid)];
	if (!instance)
		throw new Error(`Không tìm thấy hành động với mã #${aid}`);

	await instance.delete();
	return new APIResponse(0, `Xóa bỏ thành công!`, 200);
});

scheduleController.post("/:id/action/create", async ({ params: { id }, request }) => {
	const schedule = getSchedule(parseInt(id));
	if (!schedule)
		throw new Error(`Không tìm thấy lịch điều khiển với mã #${id}`);

	const { targetId, targetKind, action, newValue } = await request.json();

	const instance = await ScheduleAction.create({
		schedule,
		targetId,
		targetKind,
		action,
		newValue
	});

	return new APIResponse(0, `Tạo điều kiện mới thành công!`, 200, await instance.getReturnData());
});

scheduleController.get("/test", async ({ query: { cron: cronExpression }, request }) => {
	return new APIResponse(0, `Kiểm tra biểu thức`, 200, {
		timestamp: cron.sendAt(cronExpression as string).toMillis() / 1000,
		timeout: cron.timeout(cronExpression as string) / 1000
	});
});
