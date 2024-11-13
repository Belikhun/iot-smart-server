import { SignaleOptions, Signale, type DefaultMethods } from "signale";

export type WebLoggingMethods = "incoming" | "outgoing";
export type Logger = Signale<DefaultMethods | WebLoggingMethods>;

const options: SignaleOptions<DefaultMethods | WebLoggingMethods> = {
	disabled: false,
	interactive: false,
	logLevel: "info",
	scope: "application",
	stream: process.stdout,
	secrets: [],

	types: {
		await: {
			label: "đang chạy",
			badge: "⏳",
			color: "blueBright"
		},

		success: {
			label: "thành công",
			badge: "✔",
			color: "greenBright"
		},

		error: {
			label: "lỗi",
			badge: "💣",
			color: "redBright"
		},

		warn: {
			label: "cảnh báo",
			badge: "⚠",
			color: "yellowBright"
		},

		debug: {
			label: "debug",
			badge: "🔍",
			color: "gray"
		},

		pending: {
			label: "đang chờ",
			badge: "…",
			color: "magentaBright"
		},

		watch: {
			label: "theo dõi",
			badge: "…",
			color: "cyanBright"
		},

		complete: {
			label: "hoàn thành",
			badge: "👍",
			color: "greenBright"
		},

		incoming: {
			label: "yêu cầu",
			badge: "↓",
			color: "gray",
			logLevel: "debug"
		},

		outgoing: {
			label: "phản hồi",
			badge: "↑",
			color: "gray",
			logLevel: "debug"
		},

		// remind: {
		// 	badge: "**",
		// 	color: "yellow",
		// 	label: "reminder",
		// 	logLevel: "info"
		// },

		// santa: {
		// 	badge: "🎅",
		// 	color: "red",
		// 	label: "santa",
		// 	logLevel: "info"
		// }
	}
};

export const log: Logger = new Signale(options);

export const scope = (scope: string): Logger => new Signale({
	...options,
	scope
});

export const interactive = (scope: string): Logger => new Signale({
	...options,
	scope,
	interactive: true
});
