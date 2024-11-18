
function encodeInt16ArrayToBase64(int16Array) {
	const uint8Array = new Uint8Array(int16Array.buffer);

	let binaryString = "";
	for (let i = 0; i < uint8Array.length; i++)
		binaryString += String.fromCharCode(uint8Array[i]);

	return btoa(binaryString);
}

function decodeBase64ToInt16Array(base64String) {
	const binaryString = atob(base64String);
	const uint8Array = new Uint8Array(binaryString.length);

	for (let i = 0; i < binaryString.length; i++)
		uint8Array[i] = binaryString.charCodeAt(i);

	return new Int16Array(uint8Array.buffer);
}


const assistant = {

	/**
	 * @typedef {{
	 * 	id: string
	 * 	view: TreeDOM
	 * }} AssistantInstance
	 */

	/**
	 * @typedef {{
	 * 	messageId: string
	 * 	view: TreeDOM
	 * 	message: string
	 * }} AssistantMessageInstance
	 */

	/**
	 * @typedef {{
	 * 	callId: string
	 * 	view: TreeDOM
	 * }} AssistantCallInstance
	 */

	/** @type {TreeDOM} */
	view: undefined,

	/** @type {TreeDOM} */
	welcome: undefined,

	/** @type {TreeDOM} */
	button: undefined,
	
	/** @type {SQButton} */
	sendButton: undefined,
	
	/** @type {SQButton} */
	voiceButton: undefined,
	
	/** @type {SQButton} */
	closeButton: undefined,

	/** @type {Scrollable} */
	scroll: undefined,
	
	/** @type {HTMLTextAreaElement} */
	textbox: undefined,

	/** @type {{ [id: string]: AssistantInstance }} */
	instances: {},

	/** @type {{ [messageId: string]: AssistantMessageInstance }} */
	messages: {},

	/** @type {{ [callId: string]: AssistantCallInstance }} */
	calls: {},

	/** @type {TreeDOM} */
	currentUserMessage: undefined,

	scrollDownTask: undefined,
	
	/** @type {HTMLDivElement} */
	messageNodes: undefined,

	processing: false,
	showing: false,

	/** @type {VoiceRecorder} */
	recorder: undefined,

	/** @type {WavStreamPlayer} */
	player: undefined,

	/** @type {"text" | "voice"} */
	mode: null,

	async init() {
		this.sendButton = createButton("", {
			icon: "paperPlaneTop",
			color: "blue",
			classes: "send",
			onClick: () => {},
			afterClicked: () => this.sendMessage(this.textbox.value)
		});

		this.voiceButton = createButton("", {
			icon: "microphone",
			color: "accent",
			classes: "voice",
			onClick: () => {},
			afterClicked: () => this.startRecord()
		});

		this.welcome = makeTree("div", "welcome-message", {
			icon: { tag: "img", src: app.url("/public/images/bard-animated.webp") },
			titl: { tag: "div", class: "title", html: "Xin chào! Tôi là <strong>Bụt</strong>, trợ lý ảo nhà thông minh của bạn!" },
			messages: { tag: "div", class: "message", text: "Tôi có thể cập nhật thông tin hiện tại về ngôi nhà tới bạn, lập lịch hoạt động của các thiết bị và hỗ trợ bạn điều khiển các thiết bị một cách dễ dàng!" }
		});

		this.view = makeTree("div", "assistant-chat-panel", {
			messages: { tag: "div", class: "messages", child: {
				content: { tag: "div", class: "content", child: {
					welcome: this.welcome
				}}
			}},

			chat: { tag: "div", class: "chat", child: {
				text: { tag: "div", class: "text", child: {
					textbox: { tag: "textarea", class: "textbox", placeholder: "Bạn muốn làm gì..." },
					waveform: { tag: "div", class: "waveform", child: {
						timer: { tag: "span", class: "timer", text: "00:00" },
						bars: { tag: "span", class: "bars", child: {
							scroller: { tag: "div", class: "scroller" }
						}}
					}}
				}},

				actions: { tag: "div", class: "actions", child: {
					send: this.sendButton,
					voice: this.voiceButton
				}}
			}}
		});

		this.button = makeTree("div", "assistant-chat-button", {
			icon: { tag: "img", src: app.url("/public/images/bard-mono.svg") },
			close: { tag: "icon", icon: "close" }
		});

		new TriangleBackground(this.button, {
			color: "brown",
			style: "border",
			count: 8,
			hoverable: true
		});

		this.scroll = new Scrollable(this.view.messages, {
			content: this.view.messages.content
		});

		this.textbox = this.view.chat.text.textbox;
		this.messageNodes = this.view.messages.content;

		this.textbox.addEventListener("input", async () => {
			if (this.textbox.value) {
				this.sendButton.style.display = null;
				this.voiceButton.style.display = "none";
			} else {
				this.sendButton.style.display = "none";
				this.voiceButton.style.display = null;
			}
		});

		this.textbox.addEventListener("keypress", async (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.sendMessage(this.textbox.value);
			}
		});

		this.button.addEventListener("click", async () => {
			if (!this.player) {
				if (!await this.initAudio())
					return;
			}

			(this.showing)
				? this.hidePanel()
				: this.showPanel();
		});

		app.root.appendChild(this.button);
		websocket.on("assistant:message", ({ data }) => this.assistantStartMessage(data));
		websocket.on("assistant:delta", ({ data }) => this.assistantDelta(data));
		websocket.on("assistant:commit", ({ data }) => this.assistantCommitMessage(data));
		websocket.on("assistant:user/update", ({ data }) => this.userUpdateMessage(data));

		websocket.on("assistant:start", ({ data }) => this.assistantStart(data));
		websocket.on("assistant:complete", ({ data }) => this.assistantComplete(data));
		websocket.on("assistant:call", ({ data }) => this.assistantCall(data));
	},

	/**
	 * Manually request permission to use the microphone
	 * 
	 * @returns {Promise<true>}
	 */
	async requestMicrophone() {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			alert(`Trình duyệt của bạn không hỗ trợ Media API!`);
			return false;
		}

		const permissionStatus = await navigator.permissions.query({
			name: "microphone",
		});

		if (permissionStatus.state === "denied") {
			this.log("WARN", `Không có quyền microphone`, permissionStatus);
			alert(`Bạn phải cấp quyền Microphone để sử dụng trợ lý ảo!`);
			return false;
		} else if (permissionStatus.state === "prompt") {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});

				const tracks = stream.getTracks();
				tracks.forEach((track) => track.stop());
			} catch (e) {
				this.log("WARN", `Lỗi khi yêu cầu quyền microphone`, e);
				alert(`Bạn phải cấp quyền Microphone để sử dụng trợ lý ảo!`);
				return false;
			}
		}

		return true;
	},

	async initAudio() {
		if (!await this.requestMicrophone())
			return false;
		
		this.player = new WavStreamPlayer({ sampleRate: 24000 });
		await this.player.connect();

		this.recorder = new VoiceRecorder();
		return true;
	},

	showPanel() {
		if (this.showing)
			return;

		app.root.appendChild(this.view);
		this.button.classList.add("showing");
		this.showing = true;
		this.scrollChatBottom();
		return this;
	},

	hidePanel() {
		if (!this.showing)
			return;

		app.root.removeChild(this.view);
		this.button.classList.remove("showing");
		this.showing = false;
		return this;
	},

	sendMessage(message, send = true) {
		if (this.processing)
			return;

		if (send) {
			this.sendButton.loading = true;
			this.textbox.disabled = true;
			this.mode = "text";
			this.processing = true;
		}

		const node = makeTree("div", ["message", "user"], {
			author: { tag: "div", class: "author", child: {
				image: { tag: "img", src: app.user.getAvatarUrl() },
				fullname: { tag: "span", class: "name", text: app.user.name }
			}},

			text: { tag: "div", class: "text", text: message }
		});

		this.messageNodes.appendChild(node);
		this.scrollChatBottom();
		this.currentUserMessage = node;

		if (send) {
			websocket.send("assistant:message", message);
		}
	},

	userUpdateMessage({ message }) {
		if (!this.currentUserMessage)
			return;

		if (!message)
			return;

		this.currentUserMessage.text.innerText = message;
	},

	dbToP(db, minDb = -30, maxDb = 10) {
		const adjustedDb = Math.max(0, db - minDb);
		const maxRange = maxDb - minDb;
		const percentage = Math.log10(1 + adjustedDb) / Math.log10(1 + maxRange);
		return Math.min(1, Math.max(0, percentage));
	},

	async startRecord() {
		if (this.recorder.isRecording) {
			this.recorder.stop();
			return;
		}

		this.mode = "voice";
		const start = performance.now();
		const icon = this.voiceButton.querySelector(":scope > icon");
		this.view.chat.classList.add("recording");
		icon.dataset.icon = "stop";
		this.voiceButton.background.color = "red";
		this.view.chat.text.waveform.timer.innerText = "00:00";

		const scroller = this.view.chat.text.waveform.bars.scroller;
		const widthSpace = 0.5;
		let scrollPos = -0.25;
		let delta = start;

		emptyNode(scroller);
		scroller.style.transform = null;

		this.recorder.onChunk((/** @type {Int16Array} */ data) => {
			this.log("INFO", `Đang gửi đoạn âm thanh tới máy chủ với độ dài ${data.length}`);

			websocket.send("assistant:voice/append", {
				audio: encodeInt16ArrayToBase64(data)
			});
		});

		this.recorder.onLoudness((data) => {
			// const loudness = this.dbToP(data);
			const loudness = scaleValue(data, [-40, 0], [0, 1]);

			const now = performance.now();
			const time = (now - start) / 1000;
			delta = (now - delta) / 1000;
			
			const bar = document.createElement("span");
			bar.classList.add("bar");
			scroller.appendChild(bar);

			while (scroller.childElementCount > 42) {
				scroller.removeChild(scroller.firstChild);
				scrollPos -= widthSpace;
			}

			scrollPos += widthSpace;
			scroller.style.transform = `translateX(${-scrollPos}rem)`;
			scroller.style.setProperty("--tick-duration", `${delta}s`);

			requestAnimationFrame(() => {
				bar.style.height = `${loudness * 100}%`;
			});

			const minutes = pleft(Math.floor(time / 60), 2);
			const seconds = pleft(Math.floor(time % 60), 2);
			this.view.chat.text.waveform.timer.innerText = `${minutes}:${seconds}`;
			delta = now;
		});

		await this.recorder.start();

		this.log("OKAY", `Ghi âm hoàn thành và đẩy lên máy chủ...`);
		this.voiceButton.loading = true;
		this.sendMessage("...", false);
		websocket.send("assistant:voice/commit");
	},

	assistantStart({ id }) {
		const message = makeTree("div", ["message", "assistant"], {
			author: { tag: "div", class: "author", child: {
				image: { tag: "img", src: app.url("/public/images/bard-thinking.webp") },
				fullname: { tag: "span", class: "name", text: "Trợ lý" }
			}}
		});

		this.instances[id] = {
			id,
			view: message
		};

		message.classList.add("processing");
		this.messageNodes.appendChild(message);
		this.scrollChatBottom();
	},

	assistantCall({ id, callId, name, state }) {
		if (!this.instances[id])
			return;

		const instance = this.instances[id];

		if (!this.calls[callId]) {
			this.log("INFO", `Đã nhận được lệnh gọi từ trợ lý, ID: ${callId}`);

			const view = makeTree("div", ["call", "processing"], {
				icon: { tag: "span", class: "icon", child: {
					spinner: { tag: "div", class: "simpleSpinner" }
				}},

				info: { tag: "span", class: "info", child: {
					titl: { tag: "div", class: "title", text: "Đang chuẩn bị gọi chức năng..." },
					function: { tag: "code", text: `${name}()` }
				}}
			});

			this.calls[callId] = {
				callId,
				view
			};

			instance.view.appendChild(view);
		}

		const call = this.calls[callId];
		call.view.dataset.status = state;

		if (state === "calling") {
			call.view.info.titl.innerText = "Đang thực thi...";
		} else if (state === "completed") {
			const icon = ScreenUtils.renderIcon("check");
			call.view.icon.replaceChild(icon, call.view.icon.spinner);
			call.view.info.titl.innerText = "Thực thi thành công";
			call.view.classList.remove("processing");
		}

		this.scrollChatBottom();
		return;
	},

	assistantStartMessage({ id, messageId }) {
		if (!this.instances[id])
			return;

		const instance = this.instances[id];

		const view = makeTree("div", ["text", "processing"], {
			inner: { tag: "div", class: "inner", text: "Bụt đang suy nghĩ..." }
		});

		this.log("INFO", `Đã nhận được tin nhắn từ trợ lý, ID: ${messageId}`);
		view.dataset.id = messageId;

		this.messages[messageId] = {
			messageId,
			view: view,
			message: ""
		};

		instance.view.appendChild(view);
		this.player.reset();
		this.scrollChatBottom();
	},

	assistantDelta({ id, messageId, delta }) {
		if (!this.instances[id])
			return;

		if (!this.messages[messageId])
			return;

		const message = this.messages[messageId];

		if (delta) {
			let msgUpdated = false;

			if (delta.transcript) {
				message.message += delta.transcript;
				msgUpdated = true;
			} else if (delta.text) {
				message.message += delta.text;
				msgUpdated = true;
			}

			if (msgUpdated) {
				if (typeof marked === "object") {
					message.view.inner.innerHTML = marked.parse(message.message);
				} else {	
					message.view.inner.innerText = message.message;
				}

				this.scrollChatBottom();
			}
	
			if (delta.audio) {
				const audio = decodeBase64ToInt16Array(delta.audio);
				this.player.add16BitPCM(audio);
			}
		}
	},

	assistantCommitMessage({ id, messageId }) {
		if (!this.instances[id])
			return;

		if (!this.messages[messageId])
			return;

		const message = this.messages[messageId];
		message.view.classList.remove("processing");
	},

	assistantComplete({ id }) {
		if (!this.instances[id])
			return;

		const instance = this.instances[id];

		this.log("DEBG", `[${id}] Trợ lý đã hoàn thành tin nhắn.`);

		instance.view.classList.remove("processing");
		instance.view.author.image.src = app.url("/public/images/bard-animated.webp");

		if (this.mode === "text") {
			this.sendButton.loading = false;
			this.textbox.disabled = false;
		} else {
			const icon = this.voiceButton.querySelector(":scope > icon");
			icon.dataset.icon = "microphone";
			this.voiceButton.background.color = "accent";
			this.voiceButton.loading = false;
			this.view.chat.classList.remove("recording");
		}

		this.processing = false;
		this.mode = null;

		this.textbox.value = "";
		this.textbox.dispatchEvent(new Event("input"));
		this.textbox.focus();

		this.scrollChatBottom();
	},

	scrollChatBottom() {
		clearTimeout(this.scrollDownTask);
		this.scrollDownTask = setTimeout(() => {
			this.scroll.toBottom();
		}, 100);
	}
}

app.assistant = assistant;

/**
 * Plays audio streams received in raw PCM16 chunks in the browser.
 * @class
 */
class WavStreamPlayer {
	/**
	 * Creates a new WavStreamPlayer instance.
	 * 
	 * @param {{sampleRate?: number}} options
	 */
	constructor({ sampleRate = 44100 } = {}) {
		this.sampleRate = sampleRate;
		this.context = null;
		this.stream = null;

		// Worklet code embedded as a string
		this.workletCode = `
		class StreamProcessor extends AudioWorkletProcessor {
			constructor() {
				super();
				this.hasStarted = false;
				this.hasInterrupted = false;
				this.outputBuffers = [];
				this.bufferLength = 128;
				this.write = { buffer: new Float32Array(this.bufferLength), trackId: null };
				this.writeOffset = 0;
				this.trackSampleOffsets = {};
				this.port.onmessage = (event) => {
					if (event.data) {
						const payload = event.data;

						if (payload.event === 'write') {
							const int16Array = payload.buffer;
							const float32Array = new Float32Array(int16Array.length);

							for (let i = 0; i < int16Array.length; i++) {
								float32Array[i] = int16Array[i] / 0x8000; // Convert Int16 to Float32
							}

							this.writeData(float32Array, payload.trackId);
						} else if (payload.event === 'offset' || payload.event === 'interrupt') {
							const requestId = payload.requestId;
							const trackId = this.write.trackId;
							const offset = this.trackSampleOffsets[trackId] || 0;
							this.port.postMessage({ event: 'offset', requestId, trackId, offset });

							if (payload.event === 'interrupt') {
								this.hasInterrupted = true;
							}
						} else if (payload.event === 'reset') {
							this.outputBuffers = [];
							this.write = { buffer: new Float32Array(this.bufferLength), trackId: null };
							this.writeOffset = 0;
						} else {
							throw new Error(\`Unhandled event "\${payload.event}"\`);
						}
					}
				};
			}

			writeData(float32Array, trackId = null) {
				let { buffer } = this.write;
				let offset = this.writeOffset;

				for (let i = 0; i < float32Array.length; i++) {
					buffer[offset++] = float32Array[i];

					if (offset >= buffer.length) {
						this.outputBuffers.push(this.write);
						this.write = { buffer: new Float32Array(this.bufferLength), trackId };
						buffer = this.write.buffer;
						offset = 0;
					}
				}

				this.writeOffset = offset;
				return true;
			}

			process(inputs, outputs) {
				const output = outputs[0];
				const outputChannelData = output[0];
				const outputBuffers = this.outputBuffers;

				if (this.hasInterrupted) {
					this.port.postMessage({ event: 'stop' });
					return false;
				} else if (outputBuffers.length) {
					this.hasStarted = true;
					const { buffer, trackId } = outputBuffers.shift();

					for (let i = 0; i < outputChannelData.length; i++) {
						outputChannelData[i] = buffer[i] || 0;
					}

					if (trackId) {
						this.trackSampleOffsets[trackId] = this.trackSampleOffsets[trackId] || 0;
						this.trackSampleOffsets[trackId] += buffer.length;
					}

					return true;
				} else if (this.hasStarted) {
					this.port.postMessage({ event: 'stop' });
					return false;
				} else {
					return true;
				}
			}
		}

		registerProcessor('stream_processor', StreamProcessor);
		`;
	}

	/**
	 * Connects the audio context and enables output to speakers.
	 * 
	 * @returns {Promise<void>}
	 */
	async connect() {
		this.context = new AudioContext({ sampleRate: this.sampleRate });

		if (this.context.state === "suspended")
			await this.context.resume();

		const workletBlob = new Blob([this.workletCode], { type: "application/javascript" });
		const workletUrl = URL.createObjectURL(workletBlob);

		try {
			await this.context.audioWorklet.addModule(workletUrl);
		} catch (e) {
			console.error(e);
			throw new Error("Failed to load AudioWorklet module.");
		}
	}

	/**
	 * Starts the audio stream.
	 * 
	 * @private
	 */
	start() {
		const streamNode = new AudioWorkletNode(this.context, "stream_processor");
		streamNode.connect(this.context.destination);

		streamNode.port.onmessage = (e) => {
			if (e.data.event === "stop") {
				streamNode.disconnect();
				this.stream = null;
			}
		};

		this.stream = streamNode;
	}

	/**
	 * Adds 16-bit PCM data to the currently playing audio stream.
	 * 
	 * @param {ArrayBuffer|Int16Array} arrayBuffer
	 * @returns {Int16Array}
	 */
	add16BitPCM(arrayBuffer) {
		if (!this.stream)
			this.start();

		let buffer;

		if (arrayBuffer instanceof Int16Array) {
			buffer = arrayBuffer;
		} else if (arrayBuffer instanceof ArrayBuffer) {
			buffer = new Int16Array(arrayBuffer);
		} else {
			throw new Error("Argument must be Int16Array or ArrayBuffer.");
		}

		this.stream.port.postMessage({ event: "write", buffer });
		return buffer;
	}

	reset() {
		if (this.stream) {
			this.stream.port.postMessage({ event: "reset" });
			this.stream.disconnect();
			this.stream = null;
		}
	}
}

class VoiceRecorder {
	constructor({
		sampleRate = 44100,
		silenceThreshold = 10,
		silenceTimeout = 2,
		voiceFrequencyRange = [85, 300],
	} = {}) {
		this.sampleRate = sampleRate;
		this.silenceThreshold = silenceThreshold;
		this.silenceTimeout = silenceTimeout;
		this.voiceFrequencyRange = voiceFrequencyRange;

		this.audioContext = null;
		this.mediaStream = null;
		this.analyserNode = null;
		this.workletNode = null;
		this.onChunkHandler = null;
		this.onLoudnessHandler = null;
		this.recordingResolver = null;

		this.isRecording = false;
	}

	async start() {
		if (this.isRecording)
			throw new Error("Recording is already in progress");

		this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
		this.audioContext = new AudioContext({ sampleRate: this.sampleRate });

		const source = this.audioContext.createMediaStreamSource(this.mediaStream);
		this.analyserNode = this.audioContext.createAnalyser();
		this.analyserNode.fftSize = 2048;
		this.analyserNode.smoothingTimeConstant = 0.3;

		await this.audioContext.audioWorklet.addModule(
			URL.createObjectURL(new Blob([this._getWorkletProcessorCode()], { type: "application/javascript" }))
		);

		this.workletNode = new AudioWorkletNode(this.audioContext, "voice-recorder-processor", {
			processorOptions: {
				chunkSize: 8192,
				sampleRate: this.sampleRate,
				silenceThreshold: this.silenceThreshold,
				silenceTimeout: this.silenceTimeout,
				voiceFrequencyRange: this.voiceFrequencyRange,
				loudnessInterval: 2048
			},
		});

		source.connect(this.analyserNode);
		source.connect(this.workletNode);

		this.workletNode.port.onmessage = (event) => this._handleWorkletMessage(event);

		this.isRecording = true;
		clog("INFO", "Recording started...");

		await new Promise((resolve) => {
			clog("DEBG", "Recording resolver set!");
			this.recordingResolver = resolve;
		});

		return this;
	}

	stop() {
		if (!this.isRecording)
			return;

		if (this.workletNode) {
			this.workletNode.port.postMessage({ event: "stop" });
		}

		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}

		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach((track) => track.stop());
			this.mediaStream = null;
		}

		this.isRecording = false;
		clog("INFO", "Recording stopped.");

		if (this.recordingResolver)
			this.recordingResolver();
	}

	onChunk(handler) {
		if (typeof handler !== "function") {
			throw new Error("Handler must be a function");
		}

		this.onChunkHandler = handler;
	}

	onLoudness(handler) {
		if (typeof handler !== "function") {
			throw new Error("Handler must be a function");
		}

		this.onLoudnessHandler = handler;
	}

	_handleWorkletMessage(event) {
		const { event: messageEvent, data } = event.data;

		switch (messageEvent) {
			case "chunk": {
				if (this.onChunkHandler)
					this.onChunkHandler(data);

				break;
			}
			
			case "loudness": {
				if (this.onLoudnessHandler)
					this.onLoudnessHandler(data);

				break;
			}

			case "silence": {
				clog("INFO", "Silence detected. Stopping recording...");
				this.stop();
			}

			case "stop": {
				clog("INFO", "Stop command received. Stopping recording...");
				this.stop();
			}

			default:
				break;
		}
	}

	_getWorkletProcessorCode() {
		return `
		class VoiceRecorderProcessor extends AudioWorkletProcessor {
			constructor(options) {
				super();
				const { chunkSize, sampleRate, silenceThreshold, silenceTimeout, loudnessInterval } = options.processorOptions;

				this.chunkSize = chunkSize;
				this.sampleRate = sampleRate;
				this.silenceThreshold = silenceThreshold || 10; // Default threshold in dB

				this.buffer = [];
				this.powerBuffer = []; // Stores power values for the last second
				this.silenceCounter = 0;
				this.noiseFloor = null; // For dynamic noise baseline
				this.samplesSinceLastLoudnessUpdate = 0;
				this.loudnessInterval = loudnessInterval; // 1 second interval
				this.silenceTimeout = silenceTimeout;

				this.port.onmessage = (event) => {
					if (event.data && event.data.event === "stop")
						this.handleExternalStop();
				};
			}

			calculatePowerInDb(channelData) {
				const sumSquared = channelData.reduce((sum, value) => sum + value ** 2, 0);
				const rms = Math.sqrt(sumSquared / channelData.length);
				const powerDb = 10 * Math.log10(rms || 1e-12); // Avoid log(0)
				return powerDb;
			}

			sendChunk() {
				if (this.buffer.length === 0) return;

				const chunkToSend = this.buffer.slice(0, this.chunkSize);
				this.buffer = this.buffer.slice(this.chunkSize);

				const int16Array = new Int16Array(chunkToSend.length);
				for (let i = 0; i < chunkToSend.length; i++) {
					int16Array[i] = chunkToSend[i] * 0x7fff;
				}

				this.port.postMessage({ event: 'chunk', data: int16Array });
			}

			handleExternalStop() {
				if (this.buffer.length > 0)
					this.sendChunk(); // Send the last remaining chunk

				this.port.postMessage({ event: 'stop' }); // Signal stop
				this.isStopped = true; // Set a flag to stop processing
			}

			process(inputs) {
				if (this.isStopped)
					return false;
			
				const input = inputs[0];
				if (input.length === 0) return true;

				const channelData = input[0]; // Mono audio
				const chunk = Array.from(channelData);

				const powerDb = this.calculatePowerInDb(channelData);

				// Maintain dynamic noise floor
				if (this.noiseFloor === null) {
					this.noiseFloor = powerDb; // Initialize noise floor
				} else {
					this.noiseFloor = 0.9 * this.noiseFloor + 0.1 * powerDb; // Exponential smoothing
				}

				// Silence detection logic
				const isSilent = powerDb < this.noiseFloor + this.silenceThreshold;
				if (isSilent) {
					this.silenceCounter++;

					if (this.silenceCounter >= (this.sampleRate / 128) * this.silenceTimeout) {
						this.sendChunk(); // Send the leftover chunk
						this.port.postMessage({ event: 'stop' }); // Signal stop
						return false;
					}
				} else {
					this.silenceCounter = 0;
				}

				// Buffer audio data for chunk processing
				this.buffer.push(...chunk);

				if (this.buffer.length >= this.chunkSize) {
					this.sendChunk();
				}

				// Loudness calculation for waveform rendering
				this.samplesSinceLastLoudnessUpdate += channelData.length;
				this.powerBuffer.push(powerDb);

				if (this.samplesSinceLastLoudnessUpdate >= this.loudnessInterval) {
					const avgLoudness = this.powerBuffer.reduce((sum, val) => sum + val, 0) / this.powerBuffer.length;
					this.port.postMessage({ event: 'loudness', data: avgLoudness });

					// Reset for next interval
					this.samplesSinceLastLoudnessUpdate = 0;
					this.powerBuffer = [];
				}

				return true;
			}
		}

		registerProcessor('voice-recorder-processor', VoiceRecorderProcessor);
	  `;
	}
}
