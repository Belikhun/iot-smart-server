import Elysia from "elysia";
import APIResponse from "../Classes/APIResponse";
import { getTrigger, getTriggers, registerTrigger } from "../Device/TriggerService";
import TriggerModel from "../Models/TriggerModel";
import { TriggerConditionGroup, TriggerGroups, TriggerItems } from "../Device/Triggers/TriggerConditionGroup";
import { getDeviceFeatureById } from "../Device/Device";
import { TriggerConditionItem } from "../Device/Triggers/TriggerConditionItem";
import { TriggerAction } from "../Device/Triggers/TriggerAction";

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
	return new APIResponse(0, `Đã tạo luật kích hoạt`, 200, await trigger.getReturnData());
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

	return new APIResponse(0, `Đã cập nhật luật kích hoạt`, 200, await trigger.getReturnData());
});

triggerController.get("/:id/condition", async ({ params: { id }, request }) => {
	const trigger = getTrigger(parseInt(id));

	if (!trigger)
		throw new Error(`Không tìm thấy luật kích hoạt với mã #${id}`);

	return new APIResponse(0, `Nhóm kích hoạt chính của luật ${trigger.model.name}`, 200, await trigger.group.getReturnData());
});

triggerController.post("/:id/group/:gid/edit", async ({ params: { id, gid }, request }) => {
	const trigger = getTrigger(parseInt(id));
	if (!trigger)
		throw new Error(`Không tìm thấy luật kích hoạt với mã #${id}`);

	const group = TriggerGroups[parseInt(gid)];
	if (!group)
		throw new Error(`Không tìm thấy nhóm điều kiện với mã #${gid}`);

	const { operator } = await request.json();
	await group.setOperator(operator);

	return new APIResponse(0, `Cập nhật thành công!`, 200, await group.getReturnData());
});

triggerController.delete("/:id/group/:gid/delete", async ({ params: { id, gid }, request }) => {
	const trigger = getTrigger(parseInt(id));
	if (!trigger)
		throw new Error(`Không tìm thấy luật kích hoạt với mã #${id}`);

	const group = TriggerGroups[parseInt(gid)];
	if (!group)
		throw new Error(`Không tìm thấy nhóm điều kiện với mã #${gid}`);

	await group.delete();
	return new APIResponse(0, `Xóa thành công!`, 200);
});

triggerController.post("/:id/group/:gid/create", async ({ params: { id, gid }, request }) => {
	const trigger = getTrigger(parseInt(id));
	if (!trigger)
		throw new Error(`Không tìm thấy luật kích hoạt với mã #${id}`);

	const parent = TriggerGroups[parseInt(gid)];
	if (!parent)
		throw new Error(`Không tìm thấy nhóm điều kiện với mã #${gid}`);

	const { operator } = await request.json();
	const instance = await TriggerConditionGroup.create({
		trigger,
		parent,
		operator
	});

	return new APIResponse(0, `Tạo nhóm mới thành công!`, 200, await instance.getReturnData());
});

triggerController.post("/:id/item/:iid/edit", async ({ params: { id, iid }, request }) => {
	const trigger = getTrigger(parseInt(id));
	if (!trigger)
		throw new Error(`Không tìm thấy luật kích hoạt với mã #${id}`);

	const item = TriggerItems[parseInt(iid)];
	if (!item)
		throw new Error(`Không tìm thấy điều kiện với mã #${iid}`);

	const { deviceFeature, comparator, value } = await request.json();

	item.model.deviceFeatureId = deviceFeature;
	item.model.comparator = comparator;
	item.model.value = value;
	await item.model.save();
	item.load();

	return new APIResponse(0, `Cập nhật thành công!`, 200, await item.getReturnData());
});

triggerController.delete("/:id/item/:iid/delete", async ({ params: { id, iid }, request }) => {
	const trigger = getTrigger(parseInt(id));
	if (!trigger)
		throw new Error(`Không tìm thấy luật kích hoạt với mã #${id}`);

	const item = TriggerItems[parseInt(iid)];
	if (!item)
		throw new Error(`Không tìm thấy điều kiện với mã #${iid}`);

	await item.delete();
	return new APIResponse(0, `Xóa bỏ thành công!`, 200);
});

triggerController.post("/:id/group/:gid/item/create", async ({ params: { id, gid }, request }) => {
	const trigger = getTrigger(parseInt(id));
	if (!trigger)
		throw new Error(`Không tìm thấy luật kích hoạt với mã #${id}`);

	const group = TriggerGroups[parseInt(gid)];
	if (!group)
		throw new Error(`Không tìm thấy nhóm điều kiện với mã #${gid}`);

	const { deviceFeature, comparator, value } = await request.json();

	const feature = getDeviceFeatureById(deviceFeature);
	if (!feature)
		throw new Error(`Không tìm thấy tính năng với mã #${deviceFeature}`);

	const instance = await TriggerConditionItem.create({
		trigger,
		group,
		deviceFeature: feature,
		comparator,
		value
	});

	return new APIResponse(0, `Tạo điều kiện mới thành công!`, 200, await instance.getReturnData());
});

triggerController.get("/:id/action", async ({ params: { id }, request }) => {
	const trigger = getTrigger(parseInt(id));

	if (!trigger)
		throw new Error(`Không tìm thấy luật kích hoạt với mã #${id}`);

	const actions = [];

	for (const action of Object.values(trigger.actions))
		actions.push(await action.getReturnData());

	return new APIResponse(0, `Các hành động của luật ${trigger.model.name}`, 200, actions);
});

triggerController.post("/:id/action/:aid/edit", async ({ params: { id, aid }, request }) => {
	const trigger = getTrigger(parseInt(id));
	if (!trigger)
		throw new Error(`Không tìm thấy luật kích hoạt với mã #${id}`);

	const instance = trigger.actions[parseInt(aid)];
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

triggerController.delete("/:id/action/:aid/delete", async ({ params: { id, aid }, request }) => {
	const trigger = getTrigger(parseInt(id));
	if (!trigger)
		throw new Error(`Không tìm thấy luật kích hoạt với mã #${id}`);

	const instance = trigger.actions[parseInt(aid)];
	if (!instance)
		throw new Error(`Không tìm thấy hành động với mã #${aid}`);

	await instance.delete();
	return new APIResponse(0, `Xóa bỏ thành công!`, 200);
});

triggerController.post("/:id/action/create", async ({ params: { id }, request }) => {
	const trigger = getTrigger(parseInt(id));
	if (!trigger)
		throw new Error(`Không tìm thấy luật kích hoạt với mã #${id}`);

	const { targetId, targetKind, action, newValue } = await request.json();

	const instance = await TriggerAction.create({
		trigger,
		targetId,
		targetKind,
		action,
		newValue
	});

	return new APIResponse(0, `Tạo điều kiện mới thành công!`, 200, await instance.getReturnData());
});

triggerController.get("/:id/test", async ({ params: { id }, request }) => {
	const trigger = getTrigger(parseInt(id));
	if (!trigger)
		throw new Error(`Không tìm thấy luật kích hoạt với mã #${id}`);

	const result = trigger.test();
	return new APIResponse(0, `Chạy thử thành công!`, 200, result);
});
