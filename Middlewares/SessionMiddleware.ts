import type Elysia from "elysia";
import { time } from "../Utils/belibrary";
import Session from "../Models/Session";

export const sessionMiddleware = (app: Elysia) => {
	app.derive(async (context) => {
		const timestamp = time();
		context.headers["X-Timestamp"] = `${timestamp}`;

		let session = null;
		const sessionId = context.cookie["Session"].value;

		if (sessionId)
			session = await Session.findOne({ where: { sessionId } });

		return {
			timestamp,
			session
		};
	});

	return app;
}
