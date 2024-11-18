
/**
 * Render smart switch
 * 
 * @param	{DeviceFeature}		feature
 */
function renderSmartSwitch(feature) {
	const id = `smart_switch_${randString(7)}`;

	const view = makeTree("div", ["map-color", "smart-switch"], {
		background: { tag: "div", class: "background" },

		icon: ScreenUtils.renderIcon(feature.getIcon()),
		info: { tag: "span", class: "info", child: {
			fname: { tag: "div", class: "name", text: feature.name },
			value: { tag: "div", class: "value", text: "---" }
		}}
	});

	const kind = {
		"FeatureOnOffPin": "boolean",
		"FeatureButton": "boolean",
		"FeatureKnob": "percentage"
	}[feature.kind];

	const valueResolver = {
		"boolean": (value) => (value) ? "Bật" : "Tắt",
		"percentage": (value) => `${value}%`
	}[kind];

	let previousValue = null;

	const update = () => {
		const value = feature.getValue();

		view.info.fname.innerText = feature.name;
		view.info.value.innerText = valueResolver(value);
		view.dataset.color = feature.device.color;

		if (kind === "boolean") {
			view.classList.toggle("active", value);
		} else if (kind === "percentage") {
			view.classList.toggle("active", value != 0);
		}
	}

	const updateValue = (value, source, sourceId) => {
		if (sourceId === id)
			return;

		update();
	}

	const destroy = () => {
		feature.removeValueUpdate(updateValue);
	}

	view.addEventListener("click", () => {
		const value = feature.getValue();
		let newValue;

		if (kind === "boolean") {
			newValue = !value;
		} else if (kind === "percentage") {
			if (value != 0) {
				previousValue = value;
				newValue = 0;
			} else {
				newValue = (previousValue) ? previousValue : 100;
				previousValue = null;
			}
		} else {
			return;
		}

		feature.setValue(newValue, UPDATE_SOURCE_INTERNAL, id);
		update();
	});

	feature.onValueUpdate(updateValue)
	view.dataset.color = feature.device.color;

	return {
		id,
		view,
		update,
		destroy
	}
}

function featureSearch(flag = FEATURE_FLAG_READ | FEATURE_FLAG_WRITE) {
	return {
		fetch: async (search) => {
			const features = Object.values(devices.features)
				.filter((item) => item.support(flag));

			if (!search)
				return features.slice(0, 30);

			const tokens = search
				.toLocaleLowerCase()
				.split(" ");

			return features.filter((value) => {
				const target = [value.name, value.kind, value.uuid, value.featureId, value.device.name]
					.join(" ")
					.toLocaleLowerCase();

				for (const token of tokens) {
					if (!target.includes(token))	
						return false;
				}

				return true;
			});
		},

		process: (item) => {
			return {
				label: item.renderItem(),
				value: item.id
			}
		}
	}
}

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
		if (this.view) {
			this.view.info.type.icon.dataset.icon = this.model.getIcon();
			this.view.info.info.qName.innerText = this.model.name;

			return this.view;
		}

		this.menu = new ContextMenu()
			.add({ id: "rename", text: "Đổi tên", icon: "pencil" });

		this.view = makeTree("span", "device-feature", {
			info: { tag: "div", class: "info", child: {
				type: { tag: "span", class: "type", child: {
					icon: { tag: "icon", icon: this.model.getIcon() },
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

		this.view.info.addEventListener("click", (e) => this.menu.openByMouseEvent(e));
		this.view.info.addEventListener("contextmenu", (e) => this.menu.openByMouseEvent(e));

		this.menu.onSelect((action) => {
			if (action === "rename")
				this.model.startRename();
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

			case "FeatureTemperature":
			case "FeatureHumidity": {
				const { min, max, unit, dangerous } = {
					FeatureTemperature: { min: 0, max: 60, dangerous: 42, unit: "°C" },
					FeatureHumidity: { min: 0, max: 100, dangerous: 90, unit: "%" }
				}[this.model.kind];

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

			case "FeatureRGBLed": {
				const view = document.createElement("div");
				view.classList.add("color-picker-wrapper");

				let inputHandler = null;

				const wheel = new ReinventedColorWheel({
					appendTo: view,
					wheelDiameter: 120,
					wheelThickness: 12,
					handleDiameter: 16,
					wheelReflectsSaturation: true,

					onChange: (color) => {
						if (inputHandler)
							inputHandler(color.rgb);
					}
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
						wheel.rgb = value;
					},

					get value() {
						return wheel.rgb;
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

const Comparators = {
	equal: { icon: "equals" },
	less: { icon: "lessThan" },
	lessEq: { icon: "lessThanEqual" },
	more: { icon: "greaterThan" },
	moreEq: { icon: "greaterThanEqual" },
	contains: { icon: "inboxIn" },
	inRange: { icon: "sliderSimple" },
	isOn: { icon: "toggleOn" },
	isOff: { icon: "toggleOff" },
	valueChanged: { icon: "inputNumeric" }
};

function renderComparatorValue(comparator) {
	if (!comparator)
		return { comparator, view: undefined }

	switch (comparator) {
		case "equal":
		case "less":
		case "lessEq":
		case "more":
		case "moreEq": {
			const input = createInput({
				type: "number",
				label: "Giá trị"
			});

			return {
				comparator,
				view: input.group,
				input: input.input,

				onInput: (handler) => {
					input.input.addEventListener("input", () => handler(input.input.value));
				},

				set value(value) {
					input.input.value = value;
				},

				get value() {
					return input.value;
				},

				set disabled(disabled) {
					input.disabled = disabled;
				}
			};
		}

		case "contains": {
			const input = createInput({
				type: "text",
				label: "Các giá trị (ngăn cách bằng \";\")"
			});

			return {
				comparator,
				view: input.group,
				input: input.input,

				onInput: (handler) => {
					input.input.addEventListener("input", () => handler(input.input.value));
				},

				set value(value) {
					input.input.value = value;
				},

				get value() {
					return input.value;
				},

				set disabled(disabled) {
					input.disabled = disabled;
				}
			};
		}

		case "inRange": {
			const inputMin = createInput({
				type: "number",
				label: "Cao hơn"
			});

			const inputMax = createInput({
				type: "number",
				label: "Thấp hơn"
			});

			const view = ScreenUtils.renderFlexRow(
				inputMin.group,
				inputMax.group
			);

			view.classList.remove("gap-05");
			view.classList.add("gap-10");

			const getValue = () => {
				return [
					(inputMin.value.length > 0) ? parseFloat(inputMin.value) : null,
					(inputMax.value.length > 0) ? parseFloat(inputMax.value) : null
				].join(";");
			}

			return {
				comparator,
				view,
				input: inputMin.input,

				onInput: (handler) => {
					inputMin.input.addEventListener("input", () => {
						handler(getValue());
					});

					inputMax.input.addEventListener("input", () => {
						handler(getValue());
					});
				},

				set value(value) {
					let from = null;
					let to = null;

					if (value && typeof value === "string") {
						[from, to] = value
							.split(";")
							.map((item) => ((!isFinite(item)) ? null : parseFloat(item)));
					}

					inputMin.value = from;
					inputMax.value = to;
				},

				get value() {
					return getValue();
				},

				set disabled(disabled) {
					inputMin.disabled = disabled;
					inputMax.disabled = disabled;
				}
			};
		}

		case "isOn":
		case "isOff":
		case "valueChanged": {
			return { comparator, view: undefined }
		}
	}

	const view = document.createElement("div");
	view.innerText = `Chưa hỗ trợ render so sánh ${comparator}`;

	return {
		comparator,
		view,
		input: undefined,
		onInput: () => {},
		value: false
	};
}

const ActionTypes = {
	setValue: { icon: "equals" },
	setFromFeature: { icon: "rightLeft" },
	toggleValue: { icon: "lightSwitch" }
};

function renderActionValue(action) {
	if (!action)
		return { action, view: undefined }

	switch (action) {
		case "setValue": {
			const input = createInput({
				type: "number",
				label: "Giá trị"
			});

			return {
				action,
				view: input.group,
				input: input.input,

				onInput: (handler) => {
					input.input.addEventListener("input", () => handler(input.input.value));
				},

				set value(value) {
					input.input.value = value;
				},

				get value() {
					return input.value;
				},

				set disabled(disabled) {
					input.disabled = disabled;
				}
			};
		}

		case "setFromFeature": {
			/** @type {AutocompleteInputInstance<DeviceFeature>} */
			const input = createAutocompleteInput({
				id: `action_value_renderer_${randString(7)}`,
				label: "Tính năng nguồn",
				color: "accent",
	
				...featureSearch(),
	
				onInput: (value, { trusted }) => {
					this.deviceFeature = value;
	
					if (this.view && trusted) {
						this.render();
						this.doSave();
					}
				}
			});

			return {
				action,
				view: input.group,
				input: input.input,

				onInput: (handler) => {
					input.onInput((value, { trusted }) => {
						if (!trusted)
							return;

						handler(value.uuid);
					});
				},

				set value(value) {
					input.value = devices.getDeviceFeature(value);
				},

				get value() {
					if (input.value)
						return input.value.uuid;

					return null;
				},

				set disabled(disabled) {
					input.disabled = disabled;
				}
			};
		}

		case "toggleValue": {
			return { action, view: undefined }
		}
	}

	const view = document.createElement("div");
	view.innerText = `Chưa hỗ trợ render so sánh ${action}`;

	return {
		action,
		view,
		input: undefined,
		onInput: () => {},
		value: false
	};
}
