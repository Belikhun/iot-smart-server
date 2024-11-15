
/** @type {{ [uuid: string]: FeatureRenderer }} */
const featureRenderers = {};

class FeatureRenderer {
	/**
	 * @typedef {{
	 * 	view: TreeDOM | HTMLElement
	 * 	onInput: (handler: (value: any) => void) => this
	 * 	value: any
	 * }} FeatureContentInstance
	 */

	static get FEATURES() {
		return {
			"FeatureButton": { icon: "lightSwitch" },
			"FeatureOnOffPin": { icon: "binary" },
			"FeatureRGBLed": { icon: "lightbulb" },
			"FeatureKnob": { icon: "joystick" },
			"FeatureTemperature": { icon: "temperatureQuarter" },
			"FeatureHumidity": { icon: "dropletPercent" },
		}
	}

	constructor(/** @type {DeviceFeature} */ model) {
		this.model = model;
		this.control = this.renderContent();
	}

	render() {
		if (this.view)
			return this.view;

		const { icon } = (FeatureRenderer.FEATURES[this.model.kind])
			? FeatureRenderer.FEATURES[this.model.kind]
			: { icon: "toggleOn" };

		this.view = makeTree("span", "device-feature", {
			info: { tag: "div", class: "info", child: {
				type: { tag: "span", class: "type", child: {
					icon: { tag: "icon", icon: icon },
					typeName: { tag: "span", class: "name", text: this.model.kind }
				}},

				info: { tag: "span", class: "info", child: {
					qName: { tag: "span", class: "name", text: this.model.name }
				}}
			}},

			content: { tag: "div", class: "content", child: { content: this.control.view } },

			footer: { tag: "div", class: "footer", child: {
				uuid: ScreenUtils.renderCopyableText({ display: this.model.uuid })
			}}
		});

		this.control.onInput((value) => {
			this.model.setValue(value, UPDATE_SOURCE_CONTROL);
		});

		this.view.classList.add(this.model.kind);
		this.view.dataset.uuid = this.model.uuid;
		return this.view;
	}

	/**
	 * Render content based on feature kind.
	 * 
	 * @returns	{FeatureContentInstance}
	 */
	renderContent() {
		/** @type {FeatureContentInstance} */
		let instance;

		switch (this.model.kind) {
			case "FeatureButton":
			case "FeatureOnOffPin": {
				const view = makeTree("div", "feature-button", {
					handle: { tag: "div", class: "handle" }
				});

				let inputHandler = null;
				let currentValue = false;

				const setValue = (value) => {
					view.classList.toggle("activated", value);
					currentValue = value;
				};

				view.addEventListener("click", () => {
					setValue(!currentValue);

					if (inputHandler)
						inputHandler(currentValue);
				});

				instance = {
					view,
					onInput: (handler) => {
						if (typeof handler !== "function")
							throw new Error(`onInput(): không phải một hàm hợp lệ`);

						inputHandler = handler;
						return this;
					},

					set value(value) {
						setValue(value);
					},

					get value() {
						return currentValue;
					}
				};

				break;
			}

			case "FeatureKnob": {
				const knob = new KnobComponent();

				let inputHandler = null;
				let currentValue = 0;

				const setValue = (value) => {
					knob.value = (value / 100);
					currentValue = value;
				};

				knob.onInput((value) => {
					value = Math.round(value * 100);

					if (inputHandler && value != this.model.value)
						inputHandler(value);
				});

				instance = {
					view: knob.container,

					onInput: (handler) => {
						if (typeof handler !== "function")
							throw new Error(`onInput(): không phải một hàm hợp lệ`);

						inputHandler = handler;
						return this;
					},

					set value(value) {
						setValue(value);
					},

					get value() {
						return currentValue;
					}
				};

				break;
			}

			case "FeatureTemperature": {
				const view = document.createElement("div");
				view.classList.add("feature-temperature");

				let currentValue = 0;

				const setValue = (value) => {
					view.innerHTML = `<strong>${value}</strong> °C`
					currentValue = value;
				};

				instance = {
					view,

					onInput: (handler) => {},

					set value(value) {
						setValue(value);
					},

					get value() {
						return currentValue;
					}
				};

				break;
			}

			case "FeatureHumidity": {
				const view = document.createElement("div");
				view.classList.add("feature-humidity");

				let currentValue = 0;

				const setValue = (value) => {
					view.innerHTML = `<strong>${value}</strong>%`
					currentValue = value;
				};

				instance = {
					view,

					onInput: (handler) => {},

					set value(value) {
						setValue(value);
					},

					get value() {
						return currentValue;
					}
				};

				break;
			}

			case "FeatureSensorValue": {
				const { min, max, unit, dangerous } = this.model.extras;

				const gauge = new GaugeComponent({
					minValue: min,
					maxValue: max,
					dangerousValue: dangerous,
					unit
				});

				let currentValue = 0;

				const setValue = (value) => {
					gauge.value = value;
					currentValue = value;
				};

				instance = {
					view: gauge.container,

					onInput: (handler) => {},

					set value(value) {
						setValue(value);
					},

					get value() {
						return currentValue;
					}
				};

				break;
			}
		
			default: {
				const view = document.createElement("div");
				view.innerText = `Chưa hỗ trợ render tính năng ${this.model.kind}`;

				instance = {
					view,
					onInput: () => {},
					value: false
				};

				break;
			}
		}

		return instance;
	}

	static instance(/** @type {DeviceFeature} */ model) {
		if (featureRenderers[model.uuid])
			return featureRenderers[model.uuid];

		featureRenderers[model.uuid] = new this(model);
		return featureRenderers[model.uuid];
	}
}
