import type DeviceFeatureModel from "../../Models/DeviceFeatureModel";

export class FeatureBase {

	public model: DeviceFeatureModel;

	public updated: boolean = false;

	public constructor(model: DeviceFeatureModel) {
		this.model = model;
	}

	public setValue(value: any): FeatureBase {
		this.model.value = value;
		this.updated = true;
		return this;
	}
}
