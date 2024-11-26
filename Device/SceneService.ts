import SceneActionModel from "../Models/SceneActionModel";
import SceneModel from "../Models/SceneModel";
import { time } from "../Utils/belibrary";
import { scope, type Logger } from "../Utils/Logger";
import { SceneAction } from "./Scenes/SceneAction";

type SceneDict = { [id: number]: Scene };

const log = scope("scenes");
const scenes: SceneDict = {};

export class Scene {
	public model: SceneModel;
	protected log: Logger;

	public actions: { [id: number]: SceneAction } = [];

	public constructor(model: SceneModel) {
		this.model = model;
		this.log = scope(`scene:#${this.model.id}`);
	}

	public async load() {
		this.log.info(`Đang lấy thông tin các hành động...`);
		const actionModels = await SceneActionModel.findAll({
			where: { sceneId: this.model.id }
		});

		for (const actionModel of actionModels)
			this.actions[actionModel.id as number] = new SceneAction(actionModel, this);
	}

	public execute() {
		this.log.info(`Đang thực thi cảnh...`);

		for (const action of Object.values(this.actions))
			action.execute();

		this.model.lastTrigger = time();
		this.model.save();
		return true;
	}

	public async getReturnData() {
		return {
			...this.model.dataValues
		}
	}
}

export const initializeScenes = async () => {
	log.info(`Đang lấy thông tin các cảnh đã đăng ký...`);
	const sceneModels = await SceneModel.findAll({ order: [["id", "DESC"]] });
	log.success(`Tìm thấy ${sceneModels.length} cảnh đã đăng ký`);

	for (const sceneModel of sceneModels) {
		log.info(`Đang nạp cảnh ${sceneModel.name} [#${sceneModel.id}]`);
		const scene = new Scene(sceneModel);
		await scene.load();
		scenes[scene.model.id as number] = scene;
		log.success(`Nạp cảnh ${scene.model.name} thành công!`);
	}
}

export const getScenes = () => {
	return scenes;
}

export const getScene = (id: number): Scene | null => {
	if (scenes[id])
		return scenes[id];

	return null;
}

export const registerScene = async (sceneModel: SceneModel): Promise<Scene> => {
	const scene = new Scene(sceneModel);
	await scene.load();
	scenes[scene.model.id as number] = scene;
	return scene;
}
