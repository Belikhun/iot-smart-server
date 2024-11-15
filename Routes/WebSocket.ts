import Elysia, { t, type RouteSchema, type SingletonBase } from "elysia";
import { scope } from "../Utils/Logger";
import { runtime, time } from "../Utils/belibrary";
import type { ElysiaWS } from "elysia/ws";
import type { ServerWebSocket } from "bun";
import Device, { createDevice, getDevice, getDeviceFeature } from "../Device/Device";
import SessionModel from "../Models/SessionModel";
import type UserModel from "../Models/UserModel";
import { Op } from "sequelize";
import { FeatureUpdateSource } from "../Device/Features/FeatureBase";

const logDev = scope("ws:device");
const logDash = scope("ws:dashboard");
export const websocketRouter = new Elysia({ prefix: "/ws" });
export type WebSocket = ElysiaWS<ServerWebSocket<{}>, RouteSchema, SingletonBase>;
const devices: { [id: string]: Device } = {};

export const sendCommand = (ws: WebSocket, command: string, data: any = null, target = "system") => {
	const timestamp = runtime()

	const payload = {
		command,
		data,
		target,
		timestamp
	};

	logDev.outgoing(`[${ws.id}@${timestamp}] ${command} -> ${target}`);
	ws.send(payload);
}

websocketRouter.ws("/device", {
	body: t.Object({
		command: t.String(),
		source: t.String(),
		data: t.Any(),
		timestamp: t.Number()
	}),

	open(ws) {
		logDev.info(`${ws.remoteAddress} đã kết nối tới websocket thiết bị (ID ${ws.id})`);
	},

	close(ws) {
		if (!devices[ws.id]) {
			logDev.info(`Không tìm thấy thiết bị của websocket [${ws.id}], sẽ bỏ qua gói tin này.`);
			return;
		}

		const device = devices[ws.id];
		logDev.info(`Thiết bị ${device.model.name} (${ws.remoteAddress}) đã ngắt kết nối, bắt đầu cập nhật trạng thái...`);

		delete devices[ws.id];
		device.setWS(null);
		return;
	},

	async message(ws, { command, data, source, timestamp }) {
		logDev.incoming(`[${ws.id}@${timestamp}] ${source} -> ${command}`);

		switch (command) {
			case "auth": {
				const { hardwareId, name, token } = data;
				logDev.info(`Thiết bị ${name} [${hardwareId}] bắt đầu đăng nhập với token ${token}`);
				let device = getDevice(hardwareId);

				if (!device) {
					logDev.info(`Thiết bị với mã phần cứng ${hardwareId} chưa được đăng kí. Bắt đầu quá trình đăng kí thiết bị.`);
					device = await createDevice(data);
				}

				if (device.model.token !== token) {
					logDev.info(`Token thiết bị gửi không hợp lệ. Từ chối lệnh đăng nhập.`);
					return;
				}

				// @ts-ignore
				device.setWS(ws);

				devices[ws.id] = device;

				// @ts-ignore
				sendCommand(ws, "features");
				break;
			}

			case "update": {
				if (!devices[ws.id]) {
					logDev.info(`Không tìm thấy thiết bị của websocket [${ws.id}], sẽ bỏ qua gói tin này.`);
					return;
				}

				const device = devices[ws.id];
				device.lastHeartbeat = time();

				const { value, id, uuid } = data;
				const feature = device.getFeature(id);

				if (!feature) {
					logDev.info(`Không tìm thấy tính năng với mã ${id} [${uuid}], sẽ bỏ qua gói tin này.`);
					return;
				}

				feature.setValue(value, FeatureUpdateSource.DEVICE);
				break;
			}

			case "features": {
				if (!devices[ws.id]) {
					logDev.info(`Không tìm thấy thiết bị của websocket [${ws.id}], sẽ bỏ qua gói tin này.`);
					return;
				}

				const device = devices[ws.id];
				device.lastHeartbeat = time();

				for (const feature of data) {
					feature.featureId = feature.id;
					delete feature.id;

					if (device.getFeature(feature.featureId))
						continue;

					await device.createFeature(feature);
				}

				device.sync();
				break;
			}

			case "heartbeat": {
				if (!devices[ws.id]) {
					logDev.info(`Không tìm thấy thiết bị của websocket [${ws.id}], sẽ bỏ qua gói tin này.`);
					return;
				}

				const device = devices[ws.id];
				device.lastHeartbeat = time();
			}
		}
	}
});

const sessions: { [id: string]: SessionModel } = {}
const dashboards: { [sessionId: string]: WebSocket } = {}

export const sendDashboardCommand = (command: string, data: any = null, target = "system", ignores: string[] = []) => {
	const timestamp = runtime()

	const payload = {
		command,
		data,
		target,
		timestamp
	};

	for (const [sessionId, ws] of Object.entries(dashboards)) {
		if (ignores.includes(ws.id))
			continue;

		logDev.outgoing(`[${ws.id}@${timestamp}] ${command} -> ${sessionId}`);
		ws.send(payload);
	}
}

websocketRouter.ws("/dashboard", {
	body: t.Object({
		command: t.String(),
		source: t.String(),
		data: t.Any(),
		timestamp: t.Number()
	}),

	open(ws) {
		logDash.info(`${ws.remoteAddress} đã kết nối tới websocket bảng điều khiển (ID ${ws.id})`);
	},

	async close(ws) {
		if (!sessions[ws.id]) {
			logDash.info(`Không tìm thấy phiên của websocket [${ws.id}], sẽ bỏ qua gói tin này.`);
			return;
		}

		const session = sessions[ws.id];
		const user = (await session.getUser()) as UserModel;

		logDash.info(`Bảng điều khiển với người dùng @${user.username} (${ws.remoteAddress}) đã ngắt kết nối.`);
		delete sessions[ws.id];
	},

	async message(ws, { command, data, source, timestamp }) {
		logDash.incoming(`[${ws.id}@${timestamp}] ${source} -> ${command}`);

		if (command === "auth") {
			const { sessionId } = data;
			logDash.info(`Bảng điều khiển tại ${ws.remoteAddress} bắt đầu đăng nhập với session ${sessionId}`);

			const session = await SessionModel.findOne({
				where: {
					sessionId,
					expire: { [Op.gt]: time() }
				}
			});

			if (!session) {
				logDash.info(`Bảng điều khiển đã yêu cầu phiên không tồn tại hoặc đã hết hạn. Sẽ bỏ qua gói tin này.`);
				return;
			}

			const user = (await session.getUser()) as UserModel;
			logDash.success(`Đã đăng nhập thành công với người dùng @${user.username}`);
			sessions[ws.id] = session;

			// @ts-ignore
			dashboards[session.sessionId] = ws;
			return;
		}

		switch (command) {
			case "update": {
				if (!sessions[ws.id]) {
					logDash.info(`Không tìm thấy phiên của websocket [${ws.id}], sẽ bỏ qua gói tin này.`);
					return;
				}

				const { value, id, uuid } = data;
				const feature = getDeviceFeature(uuid);

				if (!feature) {
					logDev.info(`Không tìm thấy tính năng với mã ${id} [${uuid}], sẽ bỏ qua gói tin này.`);
					return;
				}

				// @ts-expect-error
				feature.setValue(value, FeatureUpdateSource.DASHBOARD, ws);
				break;
			}

			case "reset": {
				if (!sessions[ws.id]) {
					logDash.info(`Không tìm thấy phiên của websocket [${ws.id}], sẽ bỏ qua gói tin này.`);
					return;
				}

				const device = getDevice(source);

				if (!device) {
					logDev.info(`Không tìm thấy thiết bị với mã phần cứng ${source}, sẽ bỏ qua gói tin này.`);
					return;
				}

				device.reset();
				break;
			}
		}
	}
});
