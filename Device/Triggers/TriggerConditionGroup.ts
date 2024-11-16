import TriggerConditionGroupModel from "../../Models/TriggerConditionGroupModel";
import TriggerConditionItemModel from "../../Models/TriggerConditionItemModel";
import { scope, type Logger } from "../../Utils/Logger";
import type { Trigger } from "../TriggerService";
import type { TriggerCondition } from "./TriggerCondition";
import { TriggerConditionItem } from "./TriggerConditionItem";

export enum GroupOperator {
	AND = "and",
	AND_NOT = "andNot",
	OR = "or"
}

type TriggerGroupDict = { [id: number]: TriggerConditionGroup };
type TriggerItemDict = { [id: number]: TriggerConditionItem };

export const TriggerGroups: TriggerGroupDict = {};
export const TriggerItems: TriggerItemDict = {};

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

		TriggerGroups[this.model.id as number] = this;
	}

	public async setOperator(operator: GroupOperator) {
		this.operator = operator;
		this.model.operator = operator;
		await this.model.save();
		return this;
	}

	public async load() {
		this.items = [];

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
		this.reOrder();
		return this;
	}

	public reOrder() {
		this.items = this.items.sort((a, b) => a.order - b.order);
		return this;
	}

	public evaluate(): boolean {
		switch (this.operator) {
			case GroupOperator.AND: {
				for (const item of this.items) {
					if (!item.evaluate())
						return false;
				}

				return true;
			}

			case GroupOperator.AND_NOT: {
				for (const item of this.items) {
					if (item.evaluate())
						return false;
				}

				return true;
			}

			case GroupOperator.OR: {
				for (const item of this.items) {
					if (item.evaluate())
						return true;
				}

				return false;
			}
		}

		return false;
	}

	public async delete() {
		this.log.info(`Đang xóa toàn bộ các thành phần trong nhóm điều kiện này...`);
		await Promise.all(this.items.map((item) => item.delete()));

		this.log.info(`Đang xóa các liên kết liên quan tới nhóm điều kiện...`);
		delete TriggerGroups[this.model.id as number];

		this.log.info(`Đang xóa bản ghi trong cơ sở dữ liệu...`);
		await this.model.destroy({ force: true });
		this.items = [];

		if (this.parent) {
			this.log.info(`Đang loại bỏ liên kết với nhóm cha... (#${this.parent.model.id})`);
			const index = this.parent.items.indexOf(this);

			if (index >= 0) {
				this.log.debug(`Loại bỏ khỏi danh sách tại vị trí #${index}`);
				this.parent.items.splice(index, 1);
			} else {
				this.log.debug(`Ép cha tải lại danh sách`);
				await this.parent.load();
			}
		}

		return this;
	}

	public async getReturnData() {
		const items = [];

		for (const item of this.items)
			items.push(await item.getReturnData());

		return {
			...this.model.dataValues,
			kind: "group",
			items
		}
	}

	public static async create({
		trigger,
		parent = null,
		operator
	}: {
		trigger: Trigger,
		parent: TriggerConditionGroup | null,
		operator: GroupOperator
	}) {
		const order = (parent)
			? ((parent.items.length > 0) ? (parent.items[parent.items.length - 1].order + 1) : 0)
			: 0;

		const model = await TriggerConditionGroupModel.create({
			triggerId: trigger.model.id as number,
			parentId: (parent) ? parent.model.id as number : null,
			operator,
			order
		});

		const instance = new this(model, trigger);
		instance.parent = parent;
		await instance.load();

		if (parent)
			parent.items.push(instance);

		return instance;
	}
}
