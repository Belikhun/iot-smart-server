import type DeviceModel from "../Models/DeviceModel";

export enum DeviceStatus {
	DISCONNECTED = "disconnected",
	AUTHENTICATING = "authenticating",
	CONNECTED = "connected",
	RECONNECTING = "reconnecting"
}

export default class Device {

	public model: DeviceModel;

	public status: DeviceStatus = DeviceStatus.DISCONNECTED;

	public constructor(model: DeviceModel) {
		this.model = model;
	}
}
