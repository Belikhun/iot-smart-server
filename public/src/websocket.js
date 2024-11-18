
const websocket = {

	connected: false,

	/** @type {WebSocket} */
	socket: null,

	registeredHandlers: {},

	init() {

	},

	connect() {
		const protocol = (location.protocol === "https:")
			? "wss:"
			: "ws:";

		this.socket = new WebSocket(`${protocol}//${location.host}/ws/dashboard`);

		this.socket.addEventListener("open", (event) => {
			this.open(event);
		});

		this.socket.addEventListener("message", (event) => {
			this.message(event);
		});

		this.socket.addEventListener("close", (event) => {
			this.close(event);
		});
	},

	/**
	 * Send command to server.
	 * 
	 * @param	{string}	command
	 * @param	{any}		data
	 * @param	{string}	source
	 */
	send(command, data = null, source = "system") {
		if (!this.connected)
			return this;

		const timestamp = time()

		const payload = {
			command,
			data,
			source,
			timestamp
		};
	
		this.log("INFO", `[@${timestamp}] ${source} -> ${command}`);
		this.socket.send(JSON.stringify(payload));
		return this;
	},

	open(event) {
		this.log("INFO", `Đã thiết lập kết nối websocket tới máy chủ`, event);
		this.connected = true;

		// Đăng nhập vào server.
		this.send("auth", { sessionId: app.session.sessionId });
	},

	/**
	 * Handle websocket close event
	 * 
	 * @param	{CloseEvent}				event 
	 */
	async close(event) {
		this.log("INFO", `Kết nối websocket đã bị đóng:`, event);
		this.connected = false;
		this.socket.close();
		this.socket = null;

		this.log("INFO", `Thử kết nối lại sau 2 giây...`);
		await delayAsync(2000);
		this.connect();
	},

	/**
	 * Handle websocket message event
	 * 
	 * @param	{MessageEvent<string>}		event 
	 */
	message(event) {
		const message = JSON.parse(event.data);
		const { command, data, target, timestamp } = message;
		this.log("INFO", `[@${timestamp}] ${command} -> ${target}`);

		switch (command) {
			case "update": {
				const { value, id, uuid } = data;
				const feature = devices.getDeviceFeature(uuid);

				if (!feature) {
					this.log("WARN", `Không tìm thấy tính năng với mã ${id} [${uuid}], sẽ bỏ qua gói tin này.`);
					return;
				}

				feature.setValue(value, UPDATE_SOURCE_SERVER);
				return;
			}

			case "update:device": {
				devices.updateDevice(target);
				return;
			}
		}

		if (this.registeredHandlers[command]) {
			for (const handler of this.registeredHandlers[command]) {
				try {
					handler({ command, data, target, timestamp })
				} catch (e) {
					this.log("WARN", e);
					continue;
				}
			}
		}

		return;
	},

	/**
	 * @typedef {{ command:string, data: any, target: string, timestamp: number }} HandlerData
	 */

	/**
	 * Listen for command event and handle it.
	 * 
	 * @param {string}							command
	 * @param {(data: HandlerData) => void}		handler
	 */
	on(command, handler) {
		if (!this.registeredHandlers[command])
			this.registeredHandlers[command] = [];

		this.registeredHandlers[command].push(handler);
		return this;
	}
}

app.websocket = websocket;
