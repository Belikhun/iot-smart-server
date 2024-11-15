import type DeviceFeatureModel from "../../Models/DeviceFeatureModel";
import { sendCommand, sendDashboardCommand, type WebSocket } from "../../Routes/WebSocket";
import { scope, type Logger } from "../../Utils/Logger";
import type Device from "../Device";
import type { TriggerConditionItem } from "../Triggers/TriggerConditionItem";
import type { Trigger } from "../TriggerService";

export enum FeatureUpdateSource {
	DEVICE = "device",
	DASHBOARD = "dashboard",
	INTERNAL = "internal"
}

export enum FeatureFlag {
	READ = 1,
	WRITE = 2
}

type FeatureValueUpdateHandler = (value: any) => void | Promise<void>;

export class FeatureBase {

	public model: DeviceFeatureModel;
	public currentValue: any;
	public updated: boolean = false;
	public needSync: boolean = false;
	public shouldPushValue: boolean = false;
	public device: Device;
	public kind: string;
	public flags: number;

	protected log: Logger;
	public relatedTriggerItems: TriggerConditionItem[] = [];

	protected updateHandler: FeatureValueUpdateHandler | null = null;

	public constructor(model: DeviceFeatureModel, device: Device) {
		this.kind = this.constructor.name;
		this.model = model;
		this.device = device;
		this.flags = model.flags || 3;
		this.log = scope(`feature:${model.uuid}`);
		this.currentValue = this.processValue(this.unserializeValue(model.value));
	}

	public value(newValue: any | undefined = undefined) {
		if (newValue !== undefined)
			this.setValue(newValue);

		return this.getValue();
	}

	public defaultValue(): any {
		return false;
	}

	public setValue(
		newValue: any,
		source: FeatureUpdateSource = FeatureUpdateSource.INTERNAL,
		sourceWS: WebSocket | null = null
	): FeatureBase {
		const processedValue = this.processValue(newValue);

		if (this.currentValue === newValue)
			return this;

		this.currentValue = processedValue;
		this.updated = true;
		this.log.info(`value=`, this.currentValue, ` src=${source}`);

		if (this.updateHandler)
			this.updateHandler(this.currentValue);

		if (source !== FeatureUpdateSource.DASHBOARD || sourceWS) {
			this.log.debug("Sẽ thực hiện cập nhật bảng điều khiển");
			this.doUpdateDashboard(sourceWS);
		}

		if (source !== FeatureUpdateSource.DEVICE) {
			this.log.debug("Sẽ thực hiện cập nhật trạng thái phần cứng");
			this.shouldPushValue = true;
		}

		if (this.relatedTriggerItems.length > 0) {
			this.log.info(`Đang chạy ${this.relatedTriggerItems.length} nhóm điều kiện liên quan...`);

			for (const item of this.relatedTriggerItems) {
				if (!item.evaluate()) {
					this.log.info(`Thử kiểm tra điều kiện thất bại, sẽ bỏ qua nhóm điều kiện này`);
					continue;
				}

				item.trigger.evaluate();
			}
		}

		return this;
	}

	public getValue(): any {
		return this.currentValue;
	}

	public support(flag: FeatureFlag): boolean {
		return ((this.flags & flag) > 0);
	}

	public onUpdate(handler: FeatureValueUpdateHandler) {
		this.updateHandler = handler;
		return this;
	}

	public pushValue() {
		if (!this.shouldPushValue)
			return;

		this.doPushValue();
		return this;
	}

	/**
	 * Push this value to dashboard.
	 *
	 * @param	{WebSocket}		[sourceWS=null]		The source websocket that triggered this update.
	 */
	protected doUpdateDashboard(sourceWS: WebSocket | null = null) {
		sendDashboardCommand(
			"update",
			this.getUpdateData(),
			this.model.uuid,
			sourceWS ? [sourceWS.id] : []
		);

		return this;
	}

	/**
	 * Push this value to the respective hardware.
	 */
	protected doPushValue() {
		if (this.device.websocket)
			sendCommand(this.device.websocket, "update", this.getUpdateData(), this.model.uuid)

		this.shouldPushValue = false;
		return this;
	}

	public async save() {
		this.log.debug(`Đang lưu giá trị vào cơ sở dữ liệu...`);
		this.model.previousValue = this.model.value;
		this.model.value = this.serializeValue(this.getValue());
		await this.model.save();
		this.updated = false;

		return this;
	}

	public processValue(value: any): any {
		return value;
	}

	protected serializeValue(value: any): string {
		return value;
	}

	protected unserializeValue(value: string): any {
		return value;
	}

	public async getReturnData() {
		return {
			...this.model.dataValues,
			value: this.getValue(),
			extras: this.model.get("extras")
		}
	}

	public getUpdateData() {
		return {
			id: this.model.deviceId,
			uuid: this.model.uuid,
			value: this.getValue()
		}
	}
}
