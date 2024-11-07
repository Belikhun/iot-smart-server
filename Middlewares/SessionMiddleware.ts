import type Elysia from "elysia";
import { time } from "../Utils/belibrary";
import SessionModel from "../Models/SessionModel";

export const sessionMiddleware = (app: Elysia) => {
	app.derive(async (context) => {
		const timestamp = time();
		context.headers["X-Timestamp"] = `${timestamp}`;

		let session = null;
		const sessionId = context.cookie["Session"].value;

		if (sessionId)
			session = await SessionModel.findOne({ where: { sessionId } });

		return {
			timestamp,
			session
		};
	});

	return app;
}
