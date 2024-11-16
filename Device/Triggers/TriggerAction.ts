import TriggerActionModel from "../../Models/TriggerActionModel";
import { scope, type Logger } from "../../Utils/Logger";
import { getDeviceFeatureById } from "../Device";
import type { FeatureBase } from "../Features/FeatureBase";
import type { Trigger } from "../TriggerService";

enum ActionType {
	SET_VALUE = "setValue",
	SET_FROM_FEATURE = "setFromFeature",
	TOGGLE_VALUE = "toggleValue"
}

export class TriggerAction {

	public trigger: Trigger;
	public model: TriggerActionModel;
	protected feature: FeatureBase;
	protected action: ActionType;

	protected log: Logger;

	public constructor(model: TriggerActionModel, trigger: Trigger) {
		this.trigger = trigger;
		this.model = model;
		this.log = scope(`trigger:group:#${this.model.id}`);

		const feature = getDeviceFeatureById(this.model.deviceFeatureId);

		if (!feature)
			throw new Error(`Không tìm thấy tính năng với mã ${this.model.deviceFeatureId}`);

		this.feature = feature;
		this.action = this.model.action as ActionType;
	}

	public load() {
		if (this.feature.model.id == this.model.deviceFeatureId)
			return this;

		const feature = getDeviceFeatureById(this.model.deviceFeatureId);

		if (!feature)
			throw new Error(`Không tìm thấy tính năng với mã ${this.model.deviceFeatureId}`);

		this.feature = feature;
		this.action = this.model.action as ActionType;
		return this;
	}

	public execute() {
		this.log.info(`Đang chạy hành động #${this.model.id} -> ${this.feature.model.uuid}`);

		switch (this.action) {
			case ActionType.SET_VALUE: {
				this.feature.setValue(this.model.newValue);
				break;
			}

			case ActionType.SET_FROM_FEATURE: {
				const source = getDeviceFeatureById(this.model.newValue as number);

				if (!source) {
					this.log.warn(`Không tìm thấy tính năng với mã #${this.model.newValue}`);
					return;
				}

				this.feature.setValue(source.getValue());
				break;
			}

			case ActionType.TOGGLE_VALUE: {
				this.feature.setValue(!this.feature.getValue());
				break;
			}
		}

		return this;
	}

	public async delete() {
		this.log.info(`Đang xóa các liên kết liên quan tới nhóm điều kiện...`);
		delete this.trigger.actions[this.model.id as number];

		this.log.info(`Đang xóa bản ghi trong cơ sở dữ liệu...`);
		await this.model.destroy({ force: true });

		return this;
	}

	public async getReturnData() {
		return {
			...this.model.dataValues
		}
	}

	public static async create({
		trigger,
		deviceFeature,
		action,
		newValue
	}: {
		trigger: Trigger,
		deviceFeature: FeatureBase,
		action: ActionType,
		newValue: any
	}) {
		const model = await TriggerActionModel.create({
			triggerId: trigger.model.id as number,
			deviceFeatureId: deviceFeature.model.id as number,
			action,
			newValue
		});

		const instance = new this(model, trigger);
		instance.load();
		trigger.actions[instance.model.id as number] = instance;

		return instance;
	}
}
