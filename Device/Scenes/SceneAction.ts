import SceneActionModel from "../../Models/SceneActionModel";
import { scope, type Logger } from "../../Utils/Logger";
import { setFeatureValueByAction, type ActionType } from "../ActionFactory";
import { getDeviceFeatureById } from "../Device";
import type { FeatureBase } from "../Features/FeatureBase";
import type { Scene } from "../SceneService";

type SceneActionDict = { [id: number]: SceneAction };

const log = scope("sceneActions");
const sceneActions: SceneActionDict = {};

export class SceneAction {

	public scene: Scene;
	public model: SceneActionModel;
	protected target: FeatureBase;
	protected action: ActionType;

	protected log: Logger;

	public constructor(model: SceneActionModel, scene: Scene) {
		this.scene = scene;
		this.model = model;
		this.log = scope(`scene:action:#${this.model.id}`);

		this.target = this.getTarget();
		this.action = this.model.action as ActionType;
	}

	public getTarget(): FeatureBase {
		const feature = getDeviceFeatureById(this.model.deviceFeatureId);

		if (!feature)
			throw new Error(`Không tìm thấy tính năng với mã ${this.model.deviceFeatureId}`);

		return feature;
	}

	public load() {
		this.action = this.model.action as ActionType;
		this.target = this.getTarget();
		return this;
	}

	public execute() {
		this.log.info(`Đang chạy hành động #${this.model.id} -> ${this.target.model.uuid}`);
		setFeatureValueByAction(this.target, this.action, this.model.newValue);
		return this;
	}

	public async delete() {
		this.log.info(`Đang xóa các liên kết liên quan tới cảnh...`);
		delete this.scene.actions[this.model.id as number];

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
		scene,
		deviceFeatureId,
		action,
		newValue
	}: {
		scene: Scene,
		deviceFeatureId: number,
		action: ActionType,
		newValue: any
	}) {
		const model = await SceneActionModel.create({
			sceneId: scene.model.id as number,
			deviceFeatureId,
			action,
			newValue
		});

		const instance = new this(model, scene);
		instance.load();
		scene.actions[instance.model.id as number] = instance;

		return instance;
	}
}

export const getSceneActions = () => {
	return sceneActions;
}

export const getSceneAction = (id: number): SceneAction | null => {
	if (sceneActions[id])
		return sceneActions[id];

	return null;
}
