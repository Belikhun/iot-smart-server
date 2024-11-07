import Elysia, { type Context as BaseContext } from "elysia";
import { apiRouter } from "./Routes/API";
import config from "./Config/Config";
import { scope } from "./Utils/Logger";
import staticPlugin from "@elysiajs/static";
import path from "path";
import serverTiming from "@elysiajs/server-timing";
import { sessionMiddleware } from "./Middlewares/SessionMiddleware";
import APIResponse from "./Classes/APIResponse";
import type SessionModel from "./Models/SessionModel";
import { time } from "./Utils/belibrary";
import { websocketRouter } from "./Routes/WebSocket";

const log = scope("http");

export interface HttpServerContext extends BaseContext {
	timestamp: number
	session?: SessionModel
}

export const server = new Elysia()
	.use(sessionMiddleware)
	.use(serverTiming())
	.use(staticPlugin({ assets: path.resolve("public"), prefix: "/", indexHTML: true }));

server.onRequest(({ request }) => {
	log.incoming(`${request.method} ${request.url}`);
});

server.mapResponse(({ set, path, headers, response }) => {
	const timestamp = (headers["X-Timestamp"])
		? parseInt(headers["X-Timestamp"])
		: 0;

	if (response instanceof APIResponse) {
		set.status = response.status;
		response.timestamp = timestamp;
		response.runtime = time() - timestamp;
		response.header("X-Timestamp", response.timestamp.toString());
		response.header("X-Runtime", response.runtime.toString());

		log.outgoing(`[⚙ API] ${path} ${set.status}`);

		const newResponse = new Response(
			JSON.stringify(response, null, "\t"),
			{
				headers: {
					"Content-Type": "application/json;charset=utf-8"
				}
			}
		);

		for (const [name, value] of Object.entries(response.getHeaders()))
			newResponse.headers.set(name, value);

		return newResponse;
	}

	log.outgoing(`[📁 PUBLIC] ${path} ${set.status}`);
	return response;
});

server.onError(({ code, error, path }) => {
	const errorCode = {
		"UNKNOWN": -1,
		"VALIDATION": 1,
		"NOT_FOUND": 2,
		"PARSE": 3,
		"INTERNAL_SERVER_ERROR": 4,
		"INVALID_COOKIE_SIGNATURE": 5
	}[code];

	const statusCode = {
		"UNKNOWN": 403,
		"VALIDATION": 400,
		"NOT_FOUND": 404,
		"PARSE": 400,
		"INTERNAL_SERVER_ERROR": 500,
		"INVALID_COOKIE_SIGNATURE": 400
	}[code];

	log.error(`${path}`, error);

	if (path.startsWith("/api")) {
		return new APIResponse(errorCode, error.message, statusCode, {
			code,
			cause: error.cause,
			name: error.name
		});
	}

	return error;
});

server.onStart((app: Elysia) => {
	if (config.port !== "80") {
		log.success(`Máy chủ HTTP đang chạy tại http://${config.host}:${config.port}`);
		return;
	}

	log.success(`Máy chủ HTTP đang chạy tại http://${config.host}`);
});

server.onStop((app: Elysia) => {
	log.warn(`Máy chủ HTTP đã ngừng chạy.`);
});

export const initializeHttpServer = () => {
	return server
		.use(apiRouter)
		.use(websocketRouter)
		.listen({ hostname: config.host, port: config.port, development: true });
};
