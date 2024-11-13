import Elysia, { t, type RouteSchema, type SingletonBase } from "elysia";
import { scope } from "../Utils/Logger";
import { runtime } from "../Utils/belibrary";
import type { ElysiaWS } from "elysia/ws";
import type { ServerWebSocket } from "bun";
import Device, { createDevice, getDevice } from "../Device/Device";

const log = scope("ws");
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
	}

	log.outgoing(`[${ws.id}@${timestamp}] ${command}`);
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
		log.info(`${ws.remoteAddress} đã kết nối tới websocket thiết bị (ID ${ws.id})`);
	},

	close(ws) {
		if (!devices[ws.id]) {
			log.info(`Không tìm thấy thiết bị của websocket [${ws.id}], sẽ bỏ qua gói tin này.`);
			return;
		}

		const device = devices[ws.id];
		log.info(`Thiết bị ${device.model.name} (${ws.remoteAddress}) đã ngắt kết nối, bắt đầu cập nhật trạng thái...`);

		delete devices[ws.id];
		device.setWS(null);
		return;
	},

	async message(ws, { command, data, timestamp }) {
		log.incoming(`[${ws.id}@${timestamp}] ${command}`);

		switch (command) {
			case "auth": {
				const { hardwareId, name, token } = data;
				log.info(`Thiết bị ${name} [${hardwareId}] bắt đầu đăng nhập với token ${token}`);
				let device = getDevice(hardwareId);

				if (!device) {
					log.info(`Thiết bị với mã phần cứng ${hardwareId} chưa được đăng kí. Bắt đầu quá trình đăng kí thiết bị.`);
					device = await createDevice(data);
				}

				if (device.model.token !== token) {
					log.info(`Token thiết bị gửi không hợp lệ. Từ chối lệnh đăng nhập.`);
					return;
				}

				// @ts-ignore
				device.setWS(ws);

				devices[ws.id] = device;

				// @ts-ignore
				sendCommand(ws, "features");
				break;
			}

			case "update":

				break;

			case "features":
				if (!devices[ws.id]) {
					log.info(`Không tìm thấy thiết bị của websocket [${ws.id}], sẽ bỏ qua gói tin này.`);
					return;
				}

				const device = devices[ws.id];

				for (const { id, uuid, name, kind } of data) {
					if (device.getFeature(id))
						continue;

					await device.createFeature({
						featureId: id,
						uuid,
						name,
						kind
					});
				}

				break;
		}
	}
});
