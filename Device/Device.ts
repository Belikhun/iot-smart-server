import DeviceFeatureModel from "../Models/DeviceFeatureModel";
import DeviceModel from "../Models/DeviceModel";
import { sendCommand, sendDashboardCommand, type WebSocket } from "../Routes/WebSocket";
import { time } from "../Utils/belibrary";
import { scope, type Logger } from "../Utils/Logger";
import { isFeatureAvailable, resolveFeature } from "./FeatureFactory";
import type { FeatureBase } from "./Features/FeatureBase";

export enum DeviceStatus {
	DISCONNECTED = "disconnected",
	AUTHENTICATING = "authenticating",
	CONNECTED = "connected",
	RECONNECTING = "reconnecting"
}

type DeviceDict = { [hardwareId: string]: Device };
type DeviceIdMap = { [id: number]: Device };
type DeviceFeatureDict = { [uuid: string]: FeatureBase };
type DeviceFeatureIdMap = { [id: number]: FeatureBase };

const log = scope("devices");
const devices: DeviceDict = {};
const deviceIdMap: DeviceIdMap = {};
const deviceFeatures: DeviceFeatureDict = {};
const deviceFeatureIdMap: DeviceFeatureIdMap = {};

export default class Device {

	public model: DeviceModel;
	public status: DeviceStatus = DeviceStatus.DISCONNECTED;
	public websocket: WebSocket | null = null;
	public connected: boolean = false;
	public features: { [featureId: string]: FeatureBase } = {};
	protected log: Logger;
	protected heartbeatTask: any = null;
	public lastHeartbeat: number = 0;

	public constructor(model: DeviceModel) {
		this.model = model;
		this.log = scope(`device:${this.model.hardwareId}`);
	}

	public setWS(websocket: WebSocket | null) {
		const connected = !!websocket;

		if (this.connected == connected)
			return this;

		if (this.websocket && websocket && this.websocket.id == websocket.id)
			return this;

		this.connected = connected;

		if (this.connected) {
			this.log.info(`Thiết bị đã kết nối tới máy chủ`);
			this.lastHeartbeat = time();

			if (this.heartbeatTask)
				clearInterval(this.heartbeatTask);

			this.heartbeatTask = setInterval(() => {
				sendCommand(this.websocket as WebSocket, "heartbeat");
			}, 5000);
		} else {
			this.log.warn(`Thiết bị đã ngắt kết nối tới máy chủ!`);

			if (this.websocket)
				this.websocket.close();

			if (this.heartbeatTask) {
				clearInterval(this.heartbeatTask);
				this.heartbeatTask = null;
			}
		}

		this.websocket = websocket;

		sendDashboardCommand(
			"update:device",
			{
				id: this.model.id,
				hardwareId: this.model.hardwareId
			},
			this.model.hardwareId
		);

		return this;
	}

	public reset() {
		if (!this.connected || !this.websocket)
			return this;

		this.log.warn(`Đang khởi động lại thiết bị...`);
		sendCommand(this.websocket, "reset");
		this.setWS(null);
		return this;
	}

	/**
	 * Perform state sync to device.
	 *
	 * @returns	{this}
	 */
	public sync(): this {
		if (!this.connected || !this.websocket)
			return this;

		const payload = [];

		for (const feature of Object.values(this.features))
			payload.push(feature.getUpdateData())

		sendCommand(this.websocket, "sync", payload);
		return this;
	}

	public async getReturnData() {
		const featureList = [];

		for (const feature of Object.values(this.features))
			featureList.push(await feature.getReturnData());

		return {
			...this.model.dataValues,
			tags: (this.model.tags && this.model.tags.length > 0)
				? this.model.tags.split(";").filter((i) => !!i)
				: [],

			features: featureList,
			connected: this.connected,
			address: this.websocket?.remoteAddress || null
		}
	}

	public async saveUpdatedValues() {
		for (const feature of Object.values(this.features)) {
			if (!feature.updated)
				continue;

			feature.save();
		}
	}

	public async createFeature({ featureId, uuid, name, kind, flags, ...extras }: { featureId: string, uuid: string, name: string, kind: string, flags: number }) {
		if (!isFeatureAvailable(kind)) {
			log.warn(`Tính năng ${kind} hiện chưa được hỗ trợ, sẽ bỏ qua tính năng này.`);
			return null;
		}

		log.info(`Đang lưu tính năng ${name} [${featureId}] vào cơ sở dữ liệu...`);
		const model = await DeviceFeatureModel.create({
			deviceId: this.model.id as number,
			featureId,
			uuid,
			name,
			kind,
			flags,
			extras
		});

		log.info(`Đang đăng kí tính năng vào hệ thống... (id=${model.id})`);

		try {
			const feature = resolveFeature(model, this);
			this.features[feature.model.featureId] = feature;
			deviceFeatures[feature.model.uuid] = feature;
			deviceFeatureIdMap[feature.model.id as number] = feature;
			feature.setValue(feature.defaultValue());
			await feature.save();

			this.log.success(`Đã tải thành công tính năng ${feature.kind} [${feature.model.uuid}]`);
			return feature;
		} catch (e) {
			this.log.warn(`Lỗi đã xảy ra khi xử lý tính năng ${model.kind}, sẽ bỏ qua tính năng này.`, e);
			return null;
		}
	}

	public getFeature(featureId: string): FeatureBase | null {
		if (this.features[featureId])
			return this.features[featureId];

		return null;
	}

	public async loadFeatures() {
		this.log.info(`Đang nạp danh sách tính năng...`);

		const deviceFeatureModels = await DeviceFeatureModel.findAll({
			where: { deviceId: this.model.id }
		});

		this.log.success(`Đã tìm thấy ${deviceFeatureModels.length} tính năng được đăng ký`);

		for (const featureModel of deviceFeatureModels) {
			if (!isFeatureAvailable(featureModel.kind)) {
				log.warn(`Tính năng ${featureModel.kind} hiện chưa được hỗ trợ, sẽ bỏ qua tính năng này.`);
				continue;
			}

			try {
				const feature = resolveFeature(featureModel, this);
				this.features[feature.model.featureId] = feature;
				deviceFeatures[feature.model.uuid] = feature;
				deviceFeatureIdMap[feature.model.id as number] = feature;
				this.log.success(`Đã tải thành công tính năng ${feature.kind} [${feature.model.uuid}]`);
			} catch (e) {
				this.log.warn(`Lỗi đã xảy ra khi xử lý tính năng ${featureModel.kind}, sẽ bỏ qua tính năng này.`, e);
				continue;
			}
		}
	}
}

export const initializeDevices = async () => {
	log.info(`Đang lấy thông tin các thiết bị đã đăng ký...`);
	const deviceModels = await DeviceModel.findAll({ order: [["id", "DESC"]] });
	log.success(`Tìm thấy ${deviceModels.length} thiết bị đã đăng ký`);

	for (const deviceModel of deviceModels) {
		log.info(`Đang nạp thông tin thiết bị ${deviceModel.name} [${deviceModel.hardwareId}]`);
		const device = new Device(deviceModel);
		await device.loadFeatures();
		devices[device.model.hardwareId] = device;
		deviceIdMap[device.model.id as number] = device;
		log.success(`Nạp thông tin thiết bị ${device.model.name} thành công!`);
	}
}

export const getDevice = (hardwareId: string): Device | null => {
	if (devices[hardwareId])
		return devices[hardwareId];

	return null;
}

export const getDeviceById = (id: number): Device | null => {
	if (deviceIdMap[id])
		return deviceIdMap[id];

	return null;
}

export const getDevices = (): DeviceDict => {
	return devices;
}

export const getDeviceFeature = (uuid: string): FeatureBase | null => {
	if (deviceFeatures[uuid])
		return deviceFeatures[uuid];

	return null;
}

export const getDeviceFeatureById = (id: number): FeatureBase | null => {
	if (deviceFeatureIdMap[id])
		return deviceFeatureIdMap[id];

	return null;
}

export const createDevice = async ({ hardwareId, name, token }: { hardwareId: string, name: string, token: string }) => {
	log.info(`Đang lưu thiết bị ${name} [${hardwareId}] vào cơ sở dữ liệu...`);
	const model = await DeviceModel.create({
		hardwareId,
		name,
		token
	});

	log.info(`Đang đăng kí thiết bị vào hệ thống... (id=${model.id})`);
	const device = new Device(model);
	await device.loadFeatures();

	devices[device.model.hardwareId] = device;
	deviceIdMap[device.model.id as number] = device;
	log.success(`Nạp thông tin thiết bị ${device.model.name} thành công!`);

	sendDashboardCommand("update:device", { id: model.id, hardwareId: model.hardwareId }, model.hardwareId);
	return device;
}

setInterval(async () => {
	for (const feature of Object.values(deviceFeatures)) {
		if (!feature.updated)
			continue;

		await feature.save();
	}
}, 1000);

// Send update to devices at 20TPS.
setInterval(async () => {
	for (const feature of Object.values(deviceFeatures)) {
		if (!feature.shouldPushValue)
			continue;

		feature.pushValue();
	}
}, 50);
