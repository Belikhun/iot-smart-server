import type TriggerConditionItemModel from "../../Models/TriggerConditionItemModel";
import { scope, type Logger } from "../../Utils/Logger";
import { getDeviceFeatureById } from "../Device";
import type { FeatureBase } from "../Features/FeatureBase";
import type { Trigger } from "../TriggerService";
import type { TriggerCondition } from "./TriggerCondition";
import type { TriggerConditionGroup } from "./TriggerConditionGroup";

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
		if (typeof v2 !== "object" || !v2.length)
			return false;

		return v2.includes(v1);
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
		feature.relatedTriggerItems.push(this);
	}

	public evaluate(): boolean {
		const cType = this.model.comparator;

		if (!Comparators[cType]) {
			this.log.warn(`Bộ so sánh không tồn tại (${cType})! Sẽ trả về tín hiệu "không"`);
			return false;
		}

		const condValue = this.feature.processValue(this.model.value);
		return Comparators[cType](this.feature.getValue(), condValue);
	}
}
