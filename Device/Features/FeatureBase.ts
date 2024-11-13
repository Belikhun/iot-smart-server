import type DeviceFeatureModel from "../../Models/DeviceFeatureModel";
import { sendCommand, type WebSocket } from "../../Routes/WebSocket";
import { scope, type Logger } from "../../Utils/Logger";
import type Device from "../Device";

export enum FeatureUpdateSource {
	DEVICE = "device",
	DASHBOARD = "dashboard",
	INTERNAL = "internal"
}

type FeatureValueUpdateHandler = (value: any) => void | Promise<void>;

export class FeatureBase {

	public model: DeviceFeatureModel;
	public currentValue: any;
	public updated: boolean = false;
	public needSync: boolean = false;
	public device: Device;
	public kind: string;
	protected log: Logger;
	protected websocket: WebSocket | null = null;

	protected updateHandler: FeatureValueUpdateHandler | null = null;

	public constructor(model: DeviceFeatureModel, device: Device) {
		this.kind = this.constructor.name;
		this.model = model;
		this.device = device;
		this.log = scope(`feature:${model.uuid}`);
		this.currentValue = this.unserializeValue(model.value);
	}

	public value(newValue: any | undefined = undefined) {
		if (newValue !== undefined)
			this.setValue(newValue);
	}

	public defaultValue(): any {
		return false;
	}

	public setValue(newValue: any, source: FeatureUpdateSource = FeatureUpdateSource.INTERNAL): FeatureBase {
		this.currentValue = this.processValue(newValue)
		this.updated = true;
		this.log.info(`value=`, this.currentValue, ` src=${source}`);

		if (this.updateHandler)
			this.updateHandler(this.currentValue);

		if (source !== FeatureUpdateSource.DASHBOARD) {
			this.log.debug("Will perform dashboard update");
			this.doUpdateDashboard();
		}

		if (source !== FeatureUpdateSource.DEVICE) {
			this.log.debug("Will perform device state update");
			this.doPushValue();
		}

		return this;
	}

	public getValue(): any {
		return this.currentValue;
	}

	public onUpdate(handler: FeatureValueUpdateHandler) {
		this.updateHandler = handler;
		return this;
	}

	/**
	 * Update this value to dashboard.
	 */
	protected doUpdateDashboard() {

		return this;
	}

	/**
	 * Push this value to the respective hardware.
	 */
	protected doPushValue() {
		if (this.device.websocket)
			sendCommand(this.device.websocket, "update", this.getValue(), this.model.uuid)

		return this;
	}

	public async save() {
		this.model.value = this.serializeValue(this.getValue());
		await this.model.save();
		this.updated = false;

		return this;
	}

	protected processValue(value: any): any {
		return value;
	}

	protected serializeValue(value: any): string {
		return value;
	}

	protected unserializeValue(value: string): any {
		return value;
	}

	public getUpdateData() {
		return {
			id: this.model.deviceId,
			uuid: this.model.uuid,
			value: this.getValue()
		}
	}
}