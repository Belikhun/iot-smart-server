import TriggerActionModel, { type TriggerActionKind } from "../../Models/TriggerActionModel";
import { scope, type Logger } from "../../Utils/Logger";
import { getDeviceFeature, getDeviceFeatureById } from "../Device";
import type { FeatureBase } from "../Features/FeatureBase";
import { getSceneById, Scene } from "../SceneService";
import type { Trigger } from "../TriggerService";

enum ActionType {
	SET_VALUE = "setValue",
	SET_FROM_FEATURE = "setFromFeature",
	TOGGLE_VALUE = "toggleValue",
	ALARM_VALUE = "alarmValue"
}

export class TriggerAction {

	public trigger: Trigger;
	public model: TriggerActionModel;
	protected target: FeatureBase | Scene;
	protected action: ActionType;

	protected log: Logger;

	public constructor(model: TriggerActionModel, trigger: Trigger) {
		this.trigger = trigger;
		this.model = model;
		this.log = scope(`trigger:group:#${this.model.id}`);

		this.target = this.getTarget();
		this.action = this.model.action as ActionType;
	}

	public getTarget(): FeatureBase | Scene {
		switch (this.model.targetKind) {
			case "deviceFeature": {
				const feature = getDeviceFeatureById(this.model.targetId);

				if (!feature)
					throw new Error(`Không tìm thấy tính năng với mã ${this.model.targetId}`);

				return feature;
			}

			case "scene": {
				const scene = getSceneById(this.model.targetId);

				if (!scene)
					throw new Error(`Không tìm thấy cảnh với mã ${this.model.targetId}`);

				return scene;
			}
		}

		throw new Error(`Loại đối tượng không hợp lệ: ${this.model.targetKind}`);
	}

	public load() {
		this.action = this.model.action as ActionType;
		this.target = this.getTarget();
		return this;
	}

	public execute() {
		if (this.target instanceof Scene) {
			return;
		}

		this.log.info(`Đang chạy hành động #${this.model.id} -> ${this.target.model.uuid}`);

		switch (this.action) {
			case ActionType.SET_VALUE: {
				this.target.setValue(this.model.newValue);
				break;
			}

			case ActionType.SET_FROM_FEATURE: {
				const source = getDeviceFeature(this.model.newValue);

				if (!source) {
					this.log.warn(`Không tìm thấy tính năng với mã #${this.model.newValue}`);
					return;
				}

				this.target.setValue(source.getValue());
				break;
			}

			case ActionType.TOGGLE_VALUE: {
				this.target.setValue(!this.target.getValue());
				break;
			}

			case ActionType.ALARM_VALUE: {
				const payload: { action: string, data: any } = {
					action: this.model.newValue,
					data: null
				};

				if (this.model.newValue === "beep")
					payload.data = [0.2, 1000];

				this.target.setValue(payload);
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
		targetId,
		targetKind,
		action,
		newValue
	}: {
		trigger: Trigger,
		targetId: number,
		targetKind: TriggerActionKind,
		action: ActionType,
		newValue: any
	}) {
		const model = await TriggerActionModel.create({
			triggerId: trigger.model.id as number,
			targetId,
			targetKind,
			action,
			newValue
		});

		const instance = new this(model, trigger);
		instance.load();
		trigger.actions[instance.model.id as number] = instance;

		return instance;
	}
}
