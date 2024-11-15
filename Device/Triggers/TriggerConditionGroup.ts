import TriggerConditionGroupModel from "../../Models/TriggerConditionGroupModel";
import TriggerConditionItemModel from "../../Models/TriggerConditionItemModel";
import { scope, type Logger } from "../../Utils/Logger";
import type { Trigger } from "../TriggerService";
import type { TriggerCondition } from "./TriggerCondition";
import { TriggerConditionItem } from "./TriggerConditionItem";

enum GroupOperator {
	AND = "and",
	OR = "or"
}

export class TriggerConditionGroup implements TriggerCondition {

	public trigger: Trigger;
	public order: number;
	public parent: TriggerConditionGroup | null = null;

	public model: TriggerConditionGroupModel;
	public items: TriggerCondition[] = [];

	public operator: GroupOperator;

	protected log: Logger;

	public constructor(model: TriggerConditionGroupModel, trigger: Trigger) {
		this.model = model;
		this.trigger = trigger;
		this.order = this.model.order;
		this.operator = this.model.operator as GroupOperator;
		this.log = scope(`trigger:group:#${this.model.id}`);
	}

	public async load() {
		this.log.info("Đang tìm các thành phần thuộc nhóm này... (nhóm/điều kiện)");
		const groupModels = await TriggerConditionGroupModel.findAll({
			where: {
				triggerId: this.trigger.model.id,
				parentId: this.model.id
			}
		});

		this.log.info(`Đã tìm thấy ${groupModels.length} nhóm`);
		for (const groupModel of groupModels) {
			const group = new TriggerConditionGroup(groupModel, this.trigger);
			group.parent = this;
			await group.load();
			this.items.push(group);
		}

		const itemModels = await TriggerConditionItemModel.findAll({
			where: {
				triggerId: this.trigger.model.id,
				groupId: this.model.id
			}
		});

		this.log.info(`Đã tìm thấy ${itemModels.length} điều kiện`);
		for (const itemModel of itemModels) {
			const item = new TriggerConditionItem(itemModel, this.trigger);
			item.parent = this;
			this.items.push(item);
		}

		this.log.info(`Sắp xếp các thành phần theo thứ tự...`);
		this.items = this.items.sort((a, b) => a.order - b.order);
		return this;
	}

	public evaluate(): boolean {
		if (this.operator === GroupOperator.OR) {
			for (const item of this.items) {
				if (item.evaluate())
					return true;
			}

			return false;
		}

		for (const item of this.items) {
			if (!item.evaluate())
				return false;
		}

		return true;
	}
}
