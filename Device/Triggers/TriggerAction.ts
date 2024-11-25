import TriggerActionModel, { type TriggerActionKind } from "../../Models/TriggerActionModel";
import { scope, type Logger } from "../../Utils/Logger";
import { setFeatureValueByAction, type ActionType } from "../ActionFactory";
import { getDeviceFeatureById } from "../Device";
import type { FeatureBase } from "../Features/FeatureBase";
import { getScene, Scene } from "../SceneService";
import type { Trigger } from "../TriggerService";

export class TriggerAction {

	public trigger: Trigger;
	public model: TriggerActionModel;
	protected target: FeatureBase | Scene;
	protected action: ActionType;

	protected log: Logger;

	public constructor(model: TriggerActionModel, trigger: Trigger) {
		this.trigger = trigger;
		this.model = model;
		this.log = scope(`trigger:action:#${this.model.id}`);

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
				const scene = getScene(this.model.targetId);

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
		setFeatureValueByAction(this.target, this.action, this.model.newValue);
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
