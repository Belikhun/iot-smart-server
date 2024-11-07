import Elysia, { t } from "elysia";
import { scope } from "../Utils/Logger";

const log = scope("ws");
export const websocketRouter = new Elysia({ prefix: "/ws" });

websocketRouter.ws("/device", {
	body: t.Object({
		action: t.String(),
		payload: t.Any(),
		timestamp: t.Number()
	}),

	open(ws) {
		log.info(`${ws.remoteAddress} đã kết nối tới websocket thiết bị (ID ${ws.id})`);
	},

	message(ws, { action, payload, timestamp }) {
		log.incoming(`[#${ws.id}] ${action} @ ${timestamp}`);
	}
});
