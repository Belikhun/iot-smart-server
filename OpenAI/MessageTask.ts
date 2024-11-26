import type { RealtimeClient } from "@openai/realtime-api-beta";
import { sendCommand, type WebSocket } from "../Routes/WebSocket";
import type { ChatClientEvent } from "./Service";
import { scope, type Logger } from "../Utils/Logger";
import { encodeInt16ArrayToBase64, randomString } from "../Utils/belibrary";

export class MessageTask {

	protected ws: WebSocket;
	protected client: RealtimeClient;

	protected id: string | null = null;
	public completed: boolean = false;

	protected log: Logger;

	public tokens = {
		input: 0,
		output: 0
	}

	constructor(ws: WebSocket, client: RealtimeClient) {
		this.id = randomString(7);
		this.ws = ws;
		this.client = client;
		this.log = scope(`message:task/${this.id}`);
	}

	public execute(message: string, mode: "text" | "voice" = "text"): Promise<boolean> {
		return new Promise((resolve, rejects) => {
			let currentId: string | null = null;
			let doneTimeout: any = null;

			const listen = (event: ChatClientEvent) => {
				const { item, delta } = event;
				const { id, object, type, role, status } = item;

				if (role === "user") {
					sendCommand(this.ws, "assistant:user/update", {
						id: this.id,
						messageId: id,
						message: (item.formatted.transcript)
							? item.formatted.transcript
							: item.formatted.text
					});

					return;
				}

				if (doneTimeout && status !== "completed") {
					clearTimeout(doneTimeout);
					doneTimeout = null;
					this.log.debug(`Loại bỏ tín hiệu hoàn thành vừa rồi, vẫn còn tác vụ để chạy!`);
				}

				if (type === "function_call") {
					const { name, call_id } = item;

					sendCommand(this.ws, "assistant:call", {
						id: this.id,
						callId: call_id,
						name,
						state: (status === "completed") ? "calling" : "preparing"
					});

					return;
				}

				if (type === "function_call_output") {
					const { call_id } = item;

					sendCommand(this.ws, "assistant:call", {
						id: this.id,
						callId: call_id,
						state: "completed"
					});

					return;
				}

				if (type === "message") {
					if (currentId !== id) {
						this.log.info(`ID đã thay đổi, bắt đầu một tin nhắn mới (${id})`);
						currentId = id;

						sendCommand(this.ws, "assistant:message", {
							id: this.id,
							messageId: id
						});
					}

					if (status === "completed") {
						sendCommand(this.ws, "assistant:commit", {
							id: this.id,
							messageId: id
						});

						this.log.complete(`Tin nhắn đã hoàn thành xử lý!`);
						return;
					}

					if (!delta)
						return;

					if (delta && delta.audio)
						delta.audio = encodeInt16ArrayToBase64(delta.audio);

					sendCommand(this.ws, "assistant:delta", {
						id: this.id,
						messageId: id,
						delta
					});
				}
			};

			const handleDone = (event: ChatClientEvent) => {
				const { total_tokens, input_tokens, output_tokens } = event.response.usage;
				this.tokens.input += input_tokens;
				this.tokens.output += output_tokens;

				this.log.debug(`Nhận được tín hiệu hoàn thành!`, { total_tokens, input_tokens, output_tokens });
				clearTimeout(doneTimeout);
				doneTimeout = setTimeout(() => complete(), 1000);
			}

			const complete = () => {
				this.completed = true;

				this.client.off("conversation.updated");
				this.client.realtime.off("server.response.done", handleDone);

				sendCommand(this.ws, "assistant:complete", {
					id: this.id,
					tokens: this.tokens
				});

				this.log.info("Tác vụ đã hoàn thành!");
				resolve(true);
			}

			this.client.on("conversation.updated", listen);
			this.client.realtime.on("server.response.done", handleDone);

			sendCommand(this.ws, "assistant:start", {
				id: this.id
			});

			if (mode === "text") {
				this.client.sendUserMessageContent([
					{
						type: "input_text",
						text: message
					}
				]);
			} else {
				this.client.createResponse();
			}
		});
	}
}
