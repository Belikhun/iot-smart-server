import { RealtimeClient } from "@openai/realtime-api-beta";
import { scope } from "../Utils/Logger";
import { pleft } from "../Utils/belibrary";
import { MessageTask } from "./MessageTask";
import type { WebSocket } from "../Routes/WebSocket";
import { getDeviceFeature, getDevices } from "../Device/Device";
import type SessionModel from "../Models/SessionModel";
import { FeatureFlag } from "../Device/Features/FeatureBase";

const log = scope(`openai`);
export type ChatClientEvent = {[key: string]: any};
const clients: { [sessionId: string]: RealtimeClient } = {};

const instructions = [
	"System settings:",
	"Tool use: enabled",
	"",
	"Instructions:",
	"- You are the best home assistant that is connected to a smart home system of a family.",
	"- Your job is to listen to their command, and act accordingly to it.",
	"- Be kind, helpful, and curteous.",
	"- It is okay to ask the user questions.",
	"- Be open to exploration and conversation.",
	"",
	"Personality:",
	"- Be upbeat and genuine.",
	"- Try speaking quickly as if excited.",
	"- If interacting in a non-English language, start by using the standard accent or dialect familiar to the user.",
	"",
	"Notes:",
	"- Markdown are supported."
].join("\n");

export const getOpenAIClient = async (session: SessionModel): Promise<RealtimeClient> => {
	if (clients[session.sessionId])
		return clients[session.sessionId];

	return await initializeOpenAIClient(session);
};

export const initializeOpenAIClient = async (session: SessionModel): Promise<RealtimeClient> => {
	const { OPENAI_KEY } = process.env;

	const log = scope(`${session.sessionId.slice(-7)}/openai`);

	if (!OPENAI_KEY) {
		log.warn(`Không thể khởi tạo OpenAI Realtime Client: không có API key!`);
		throw new Error(`Không thể khởi tạo OpenAI Realtime Client: không có API key!`);
	}

	log.info(`Đang kết nối tới OpenAI với khóa ${OPENAI_KEY.slice(0, 3)}...${OPENAI_KEY.slice(-7)}`);

	const client = new RealtimeClient({ apiKey: OPENAI_KEY });
	clients[session.sessionId] = client;

	client.updateSession({
		input_audio_transcription: { model: "whisper-1" },
		instructions,
		voice: "ballad"
	});

	client.on("realtime.event", (event: ChatClientEvent) => {
		const { type, event_id } = event.event;

		if (event.source === "server") {
			log.incoming(`[openai -> client] <${pleft(event_id, 28)}> ${type}`);
		} else {
			log.outgoing(`[client -> openai] <${pleft(event_id, 28)}> ${type}`);
		}

		if (type === "error")
			log.error(event);
	});

	client.on("server.error", (event: ChatClientEvent) => {
		log.error(event);
	});

	client.addTool({
		name: "getDevices",
		description: [
			"Retrieve all smart devices registered in the system.",
			"Each devices have a features list of that device.",
			"",
			"Each features have a uuid value, this will be required in other tool's parameters that update the device's feature state.",
			"This tool should be rarely called, and should only be called when you don't have the list of available smart devices, or a new device have been added."
		].join("\n"),
		parameters: {}
	}, async ({}) => {
		log.info(`Đang gọi tool getDevices()`);
		const devices = getDevices();
		const data = [];

		for (const device of Object.values(devices))
			data.push(await device.getReturnData());

		return data;
	});

	client.addTool({
		name: "getDeviceFeatureValues",
		description: [
			"Retrieve the current value of one or many device's feature."
		].join("\n"),
		parameters: {
			"type": "object",
			"properties": {
				"features": {
					"type": "array",
					"description": "An array contains list of feature's uuids to get value for.",
					"items": {
						"type": "string",
						"description": "Device feature UUID.",
					}
				}
			},
			"required": ["features"],
			"additionalProperties": false
		}
	}, async ({ features }: { features: string[] }) => {
		log.info(`Đang gọi tool getDeviceFeatureValues():`, features);
		const messages = [];
		const data: { [key: string]: any } = {};

		for (const uuid of features) {
			const feature = getDeviceFeature(uuid);

			if (!feature) {
				messages.push(`No device feature found with UUID ${feature}`);
				continue;
			}

			data[feature.model.uuid] = feature.getValue();
		}

		return {
			values: data,
			errors: messages
		};
	});

	client.addTool({
		name: "setDeviceFeatureValues",
		description: [
			"Update a list of feature's value.",
			"The format of the feature's value must follow the value specification of the specified device feature.",
			"This tool support updating multiple features at a same time.",
			"",
			"Note:",
			"- \"FeatureKnob\"'s value is in the range of 0 to 100",
			"- Features with flags=3 indicate it can be read and written, whilst flags=1 indicate it can only be read. Only update value for feature which are updateable."
		].join("\n"),
		parameters: {
			"type": "object",
			"properties": {
				"features": {
					"type": "array",
					"description": "An array contains list of device's feature to update.",
					"items": {
						"type": "object",
						"properties": {
							"uuid": {
								"type": "string",
								"description": "Device's feature UUID."
							},

							"value": {
								"oneOf": [
									{
										"type": "number",
										"description": "A new value to be set for the device's feature. Most of the device's feature kind will use this."
									},
									{
										"type": "array",
										"description": "Value specific for \"FeatureRGBLed\" feature kind, where the value is the color following [R, G, B] format.",
										"items": {
											"type": "number"
										},
										"minItems": 3,
										"maxItems": 3
									},
									{
										"type": "boolean",
										"description": "Value specific for \"FeatureButton\" and \"FeatureOnOffPin\" feature kind, where the value is simply the on or off state."
									},
								]
							}
						},
						"required": ["uuid", "value"],
						"additionalProperties": false
					}
				}
			},
			"required": ["features"],
			"additionalProperties": false
		}
	}, async ({ features }: { features: any }) => {
		log.info(`Đang gọi tool setDeviceFeatureValues():`, features);
		const messages = [];

		for (const { uuid, value } of features) {
			const feature = getDeviceFeature(uuid);

			if (!feature) {
				messages.push(`Device feature with uuid ${uuid} does not exist!`);
				log.warn(`Không tìm thấy tính năng với UUID ${uuid}`);
				continue;
			}

			if (!feature.support(FeatureFlag.WRITE)) {
				messages.push(`Device feature with uuid ${uuid} is not writable!`);
				log.warn(`Tool đã cố gắng cập nhật giá chị cho tính năng chỉ đọc! (${uuid})`);
				continue;
			}

			feature.setValue(value);
		}

		if (messages.length === 0)
			return "All features updated successfully!";

		return messages.join("\n");
	});

	try {
		await client.connect();
		log.success(`Kết nối tới OpenAI thành công!`);
	} catch (e) {
		log.error(`Lỗi khi kết nối tới OpenAI: `, e);
		throw e;
	}

	return client;
}

export const handleAssistantMessage = async (ws: WebSocket, session: SessionModel, message: string) => {
	const client = await initializeOpenAIClient(session);

	if (!client.isConnected())
		await client.connect();

	log.info(`Chuẩn bị xử lí tin nhắn từ [${ws.id}]: ${message}`);
	const task = new MessageTask(ws, client);
	await task.execute(message);
}
