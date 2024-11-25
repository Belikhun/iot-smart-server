import TriggerActionModel from "../Models/TriggerActionModel";
import TriggerConditionGroupModel from "../Models/TriggerConditionGroupModel";
import TriggerModel from "../Models/TriggerModel";
import { time } from "../Utils/belibrary";
import { scope, type Logger } from "../Utils/Logger";
import { TriggerAction } from "./Triggers/TriggerAction";
import { GroupOperator, TriggerConditionGroup } from "./Triggers/TriggerConditionGroup";

type TriggerDict = { [id: number]: Trigger };

const log = scope("triggers");
const triggers: TriggerDict = {};

export class Trigger {

	public model: TriggerModel;
	protected log: Logger;
	public lastResult: boolean = false;

	// @ts-expect-error
	public group: TriggerConditionGroup;

	public actions: { [id: number]: TriggerAction } = [];

	public constructor(model: TriggerModel) {
		this.model = model;
		this.log = scope(`trigger:#${this.model.id}`);
	}

	public async load() {
		this.log.info(`Đang lấy thông tin nhóm điều kiện chính...`);
		let groupModel = await TriggerConditionGroupModel.findOne({
			where: {
				triggerId: this.model.id,
				parentId: null
			}
		});

		if (!groupModel) {
			groupModel = await TriggerConditionGroupModel.create({
				triggerId: this.model.id as number,
				parentId: null,
				operator: GroupOperator.AND,
				order: 0
			});
		}

		this.group = new TriggerConditionGroup(groupModel, this);
		await this.group.load();

		this.log.info(`Đang lấy thông tin các hành động...`);
		const actionModels = await TriggerActionModel.findAll({
			where: { triggerId: this.model.id }
		});

		for (const actionModel of actionModels)
			this.actions[actionModel.id as number] = new TriggerAction(actionModel, this);
	}

	public evaluate() {
		if (!this.model.active) {
			this.log.info(`Nhóm điều kiện này hiện không hoạt động.`);
			return false;
		}

		this.log.info(`Đang kiểm tra điều kiện để thực hiện hành động...`);
		this.lastResult = this.group.evaluate();

		if (!this.lastResult) {
			this.log.info(`Điều kiện không thỏa mãn.`);
			return false;
		}

		this.log.success(`Điều kiện thỏa mãn! Bắt đầu chạy các hành động...`);

		for (const action of Object.values(this.actions))
			action.execute();

		this.model.lastTrigger = time();
		this.model.save();
		return true;
	}

	public test() {
		const result = {};
		this.log.info(`Đang chạy thử các điều kiện...`);
		this.lastResult = this.group.evaluate(result);
		return result;
	}

	public async getReturnData() {
		return {
			...this.model.dataValues,
			lastResult: this.lastResult
		}
	}
}

export const initializeTriggers = async () => {
	log.info(`Đang lấy thông tin các luật tự động hóa đã đăng ký...`);
	const triggerModels = await TriggerModel.findAll({ order: [["id", "DESC"]] });
	log.success(`Tìm thấy ${triggerModels.length} luật tự động hóa đã đăng ký`);

	for (const triggerModel of triggerModels) {
		log.info(`Đang nạp luật tự động hóa ${triggerModel.name} [#${triggerModel.id}]`);
		const trigger = new Trigger(triggerModel);
		await trigger.load();
		triggers[trigger.model.id as number] = trigger;
		log.success(`Nạp luật tự động hóa ${trigger.model.name} thành công!`);
	}
}

export const getTriggers = () => {
	return triggers;
}

export const getTrigger = (id: number): Trigger | null => {
	if (triggers[id])
		return triggers[id];

	return null;
}

export const registerTrigger = async (triggerModel: TriggerModel): Promise<Trigger> => {
	const trigger = new Trigger(triggerModel);
	await trigger.load();
	triggers[trigger.model.id as number] = trigger;
	return trigger;
}
