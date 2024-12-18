import type DeviceFeatureModel from "../../Models/DeviceFeatureModel";
import TriggerConditionItemModel from "../../Models/TriggerConditionItemModel";
import { scope, type Logger } from "../../Utils/Logger";
import { getDeviceFeatureById } from "../Device";
import type { FeatureBase } from "../Features/FeatureBase";
import type { Trigger } from "../TriggerService";
import type { TriggerCondition } from "./TriggerCondition";
import { TriggerItems, type TriggerConditionGroup } from "./TriggerConditionGroup";

const Comparators: { [type: string]: (featureValue: any, conditionValue: any) => boolean } = {
	equal(v1, v2): boolean {
		return (v1 == v2);
	},

	less(v1, v2): boolean {
		return (v1 < v2)
	},

	lessEq(v1, v2): boolean {
		return (v1 <= v2)
	},

	more(v1, v2): boolean {
		return (v1 > v2)
	},

	moreEq(v1, v2): boolean {
		return (v1 >= v2)
	},

	contains(v1, v2): boolean {
		const items = v2.split(";")
			.map((item: string) => item.trim())
			.filter((item: string) => item.length > 0)
			.map((item: string) => parseInt(item));

		if (!items.length)
			return false;

		return v2.includes(+v1);
	},

	inRange(v1, v2): boolean {
		let from = null;
		let to = null;

		if (v2 && typeof v2 === "string") {
			[from, to] = v2
				.split(";")
				.map((item) => (isNaN(parseFloat(item)) ? null : parseFloat(item)));
		}

		if (typeof from === "number" && from < v1)
			return false;

		if (typeof to === "number" && v1 > to)
			return false;

		return true;
	},

	isOn(v1, v2): boolean {
		if (typeof v1 === "string")
			v1 = parseInt(v1);

		return !!v1;
	},

	isOff(v1, v2): boolean {
		if (typeof v1 === "string")
			v1 = parseInt(v1);

		return !v1;
	},

	valueChanged(v1, v2): boolean {
		return true;
	}
}

export class TriggerConditionItem implements TriggerCondition {
	public trigger: Trigger;
	public order: number;
	public parent: TriggerConditionGroup | null = null;

	public model: TriggerConditionItemModel;
	public feature: FeatureBase;

	protected log: Logger;

	public constructor(model: TriggerConditionItemModel, trigger: Trigger) {
		this.model = model;
		this.trigger = trigger;
		this.order = this.model.order;
		this.log = scope(`trigger:item:#${this.model.id}`);

		const feature = getDeviceFeatureById(this.model.deviceFeatureId);

		if (!feature)
			throw new Error(`Không tìm thấy tính năng với mã ${this.model.deviceFeatureId}`);

		this.feature = feature;
		this.feature.relatedTriggerItems[this.model.id as number] = this;
		TriggerItems[this.model.id as number] = this;
	}

	public load() {
		if (this.feature.model.id == this.model.deviceFeatureId)
			return this;

		delete this.feature.relatedTriggerItems[this.model.id as number];
		delete TriggerItems[this.model.id as number];
		const feature = getDeviceFeatureById(this.model.deviceFeatureId);

		if (!feature)
			throw new Error(`Không tìm thấy tính năng với mã ${this.model.deviceFeatureId}`);

		this.feature = feature;
		this.feature.relatedTriggerItems[this.model.id as number] = this;
		TriggerItems[this.model.id as number] = this;
		this.log.info(`Đã đăng kí với tính năng ${this.feature.model.uuid}`);

		return this;
	}

	public evaluate(result: object = {}): boolean {
		const cType = this.model.comparator;

		if (!Comparators[cType]) {
			this.log.warn(`Bộ so sánh không tồn tại (${cType})! Sẽ trả về tín hiệu "không"`);

			// @ts-ignore
			result[this.model.id as number] = {
				type: "item",
				result: false
			};

			return false;
		}

		const condValue = (cType !== "contains" && cType !== "inRange")
			? this.feature.processValue(this.model.value)
			: this.model.value;

		const value = Comparators[cType](this.feature.getValue(), condValue);

		// @ts-ignore
		result[this.model.id as number] = {
			type: "item",
			result: value
		};

		return value;
	}

	public async getReturnData() {
		return {
			...this.model.dataValues,
			kind: "item"
		}
	}

	public async delete() {
		this.log.info(`Đang xóa các liên kết liên quan tới nhóm điều kiện...`);
		delete this.feature.relatedTriggerItems[this.model.id as number];
		delete TriggerItems[this.model.id as number];

		this.log.info(`Đang xóa bản ghi trong cơ sở dữ liệu...`);
		await this.model.destroy({ force: true });

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

	public static async create({
		trigger,
		group,
		deviceFeature,
		comparator,
		value
	}: {
		trigger: Trigger,
		group: TriggerConditionGroup,
		deviceFeature: FeatureBase,
		comparator: string,
		value: any
	}) {
		const order = (group)
			? ((group.items.length > 0) ? (group.items[group.items.length - 1].order + 1) : 0)
			: 0;

		const model = await TriggerConditionItemModel.create({
			triggerId: trigger.model.id as number,
			groupId: group.model.id as number,
			deviceFeatureId: deviceFeature.model.id as number,
			comparator,
			value,
			order
		});

		const instance = new this(model, trigger);
		instance.parent = group;

		if (group)
			group.items.push(instance);

		return instance;
	}
}
