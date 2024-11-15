import TriggerActionModel from "../Models/TriggerActionModel";
import TriggerConditionGroupModel from "../Models/TriggerConditionGroupModel";
import TriggerModel from "../Models/TriggerModel";
import { time } from "../Utils/belibrary";
import { scope, type Logger } from "../Utils/Logger";
import { TriggerAction } from "./Triggers/TriggerAction";
import { TriggerConditionGroup } from "./Triggers/TriggerConditionGroup";

type TriggerDict = { [id: number]: Trigger };

const log = scope("triggers");
const triggers: TriggerDict = {};

export class Trigger {

	public model: TriggerModel;

	protected log: Logger;

	// @ts-expect-error
	public group: TriggerConditionGroup;

	public actions: TriggerAction[] = [];

	public constructor(model: TriggerModel) {
		this.model = model;
		this.log = scope(`trigger:#${this.model.id}`);
	}

	public async load() {
		this.log.info(`Đang lấy thông tin nhóm điều kiện chính...`);
		const groupModel = await TriggerConditionGroupModel.findOne({
			where: {
				triggerId: this.model.id,
				parentId: null
			}
		});

		if (!groupModel)
			throw new Error(`Không tìm thấy nhóm điều kiện chính!`);

		this.group = new TriggerConditionGroup(groupModel, this);
		await this.group.load();

		this.log.info(`Đang lấy thông tin các hành động...`);
		const actionModels = await TriggerActionModel.findAll({
			where: { triggerId: this.model.id }
		});

		for (const actionModel of actionModels)
			this.actions.push(new TriggerAction(actionModel));
	}

	public evaluate() {
		this.log.info(`Đang kiểm tra điều kiện để thực hiện hành động...`);
		const result = this.group.evaluate();

		if (!result) {
			this.log.info(`Điều kiện không thỏa mãn.`);
			return false;
		}

		this.log.success(`Điều kiện thỏa mãn! Bắt đầu chạy các hành động...`);

		for (const action of this.actions)
			action.execute();

		this.model.lastTrigger = time();
		this.model.save();
		return true;
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