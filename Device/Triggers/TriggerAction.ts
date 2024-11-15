import type TriggerActionModel from "../../Models/TriggerActionModel";
import { scope, type Logger } from "../../Utils/Logger";
import { getDeviceFeatureById } from "../Device";
import type { FeatureBase } from "../Features/FeatureBase";

export class TriggerAction {

	public model: TriggerActionModel;
	protected feature: FeatureBase;

	protected log: Logger;

	public constructor(model: TriggerActionModel) {
		this.model = model;
		this.log = scope(`trigger:group:#${this.model.id}`);

		const feature = getDeviceFeatureById(this.model.deviceFeatureId);

		if (!feature)
			throw new Error(`Không tìm thấy tính năng với mã ${this.model.deviceFeatureId}`);

		this.feature = feature;
	}

	public execute() {
		this.log.info(`Đang chạy hành động #${this.model.id} -> ${this.feature.model.uuid}`);
		this.feature.setValue(this.model.newValue);
		return this;
	}
}
