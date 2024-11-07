import Elysia from "elysia";
import { scope } from "../Utils/Logger";

const log = scope("ws");
export const websocketRouter = new Elysia({ prefix: "/ws" });

websocketRouter.ws("/device", {
	open(ws) {
		log.info(`${ws.remoteAddress} đã kết nối tới websocket thiết bị (${ws.id})`);
	},

	message(ws, message) {
		log.incoming(`(${ws.id})`);
	}
});
