import { RealtimeClient } from "@openai/realtime-api-beta";
import { scope } from "../Utils/Logger";
import { pleft } from "../Utils/belibrary";
import { MessageTask } from "./MessageTask";
import { sendDashboardCommand, type WebSocket } from "../Routes/WebSocket";
import { getDeviceFeature, getDevices } from "../Device/Device";
import type SessionModel from "../Models/SessionModel";
import { FeatureFlag } from "../Device/Features/FeatureBase";
import ScheduleModel from "../Models/ScheduleModel";
import { registerSchedule } from "../Device/ScheduleService";
import { ScheduleAction } from "../Device/Schedules/ScheduleAction";
import { ActionType } from "../Device/ActionFactory";

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
	"- Respond to user's command proactively. For example, when the user told they are feeling hot, try turning on the fan or air conditioner if available.",
	"",
	"Personality:",
	"- Be upbeat and genuine.",
	"- Try speaking quickly as if excited.",
	"- If interacting in a non-English language, start by using the standard accent or dialect familiar to the user.",
	"",
	"Notes:",
	"- Markdown are supported.",
	"- Primary language will be Vietnamese. But when user is using english, response with english."
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
			"- Feature's flags is a bitmask, where the first bit indicate the feature is readable, and the second bit indicate the feature is writable."
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
										"description": "Value specific for \"FeatureButton\" and \"FeatureOnOffToggle\" feature kind, where the value is simply the on or off state."
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

	client.addTool({
		name: "createSchedule",
		description: [
			"Create a device feature's control schedule, using CRON expression.",
			"The CRON expression has an additional second field, which mean the CRON expression has 6 fields in total. Example: * * * * * *",
			"",
			"Supported ranges:",
			"field          allowed values",
			"-----          --------------",
			"second         0-59",
			"minute         0-59",
			"hour           0-23",
			"day of month   1-31",
			"month          1-12",
			"day of week    0-7"
		].join("\n"),
		parameters: {
			"type": "object",
			"properties": {
				"name": {
					"type": "string",
					"description": "The schedule name."
				},

				"cronExpression": {
					"type": "string",
					"description": "The CRON expression for the schedule. The schedule will start running based on this CRON expression."
				},

				"executeAmount": {
					"type": "number",
					"description": [
						"The amount of time this schedule will be executed.",
						"0 = run indefinitely",
						"1 = run only once",
						"n = run for n times"
					].join("\n")
				},

				"features": {
					"type": "array",
					"description": "An array contains list of device's feature will be updated when the schedule is executed.",
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
										"description": "Value specific for \"FeatureButton\" and \"FeatureOnOffToggle\" feature kind, where the value is simply the on or off state."
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
	}, async ({ name, cronExpression, executeAmount, features }: any) => {
		log.info(`Đang gọi tool createSchedule():`, name);

		const instance = await ScheduleModel.create({
			name,
			icon: "clock",
			color: "accent",
			executeAmount: parseInt(executeAmount),
			active: true,
			cronExpression
		});

		const schedule = await registerSchedule(instance);
		const messages = [];

		for (const { uuid, value } of features) {
			const feature = getDeviceFeature(uuid);

			if (!feature) {
				messages.push(`No device feature found with UUID ${feature}`);
				continue;
			}

			await ScheduleAction.create({
				schedule,
				targetId: feature.model.id as number,
				targetKind: "deviceFeature",
				action: ActionType.SET_VALUE,
				newValue: value
			});
		}

		schedule.load();
		sendDashboardCommand("update:schedules");

		return {
			success: true,
			errors: messages
		};
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
	const client = await getOpenAIClient(session);

	if (!client.isConnected())
		await client.connect();

	log.info(`Chuẩn bị xử lí tin nhắn từ [${ws.id}]: ${message}`);
	const task = new MessageTask(ws, client);
	await task.execute(message, "text");
}

export const appendAssistantVoide = async (ws: WebSocket, session: SessionModel, audio: Int16Array) => {
	const client = await getOpenAIClient(session);

	if (!client.isConnected())
		await client.connect();

	log.info(`Nhận được đoạn giọng nói từ client, độ dài ${audio.length}`);
	client.appendInputAudio(audio);
}

export const handleAssistantVoice = async (ws: WebSocket, session: SessionModel) => {
	const client = await getOpenAIClient(session);

	if (!client.isConnected())
		await client.connect();

	log.info(`Chuẩn bị xử lí lệnh giọng nói từ [${ws.id}]`);
	const task = new MessageTask(ws, client);
	await task.execute("", "voice");
}
