// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Vloom Dashboard libs.
 *
 * @package     vloom_core
 * @author      Brindley <brindley@videabiz.com>
 * @copyright   2023 Videa {@link https://videabiz.com}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Create checkbox used in dashboard table.
 *
 * @typedef {{
 *  container: HTMLElement
 *  input: HTMLInputElement
 *  partial: boolean
 *  value: boolean
 * }} DashboardCheckbox
 *
 * @return {DashboardCheckbox}
 */
function createDashboardCheckbox() {
	const id = `dbcheckbox_` + randString(8);

	const container = makeTree("div", "db-checkbox", {
		input: { tag: "input", id, type: "checkbox" },
		label: { tag: "label", for: id, child: {
			minus: { tag: "icon", class: "minus", icon: "minus" },
			check: { tag: "icon", class: "check", icon: "check" }
		}}
	});

	const instance = {
		container,
		input: container.input,

		/**
		 * Set input partial state.
		 *
		 * @param   {boolean}   set
		 */
		set partial(set) {
			container.classList[set ? "add" : "remove"]("partial");

			if (set)
				container.input.checked = false;
		},

		/**
		 * Set input value.
		 *
		 * @param   {boolean}   value
		 */
		set value(value) {
			this.partial = false;
			container.input.checked = value;
		},

		get value() {
			return container.input.checked;
		}
	};

	container.input.addEventListener("change", () => {
		if (container.input.checked)
			instance.partial = false;
	});

	return instance;
}

/**
 * @template	{Model}		T
 * @typedef {{
 *	group: HTMLElement
 *  input: HTMLInputElement
 *  update: (trusted: boolean) => void
 * 	value: string|object|string[]|object[]|null
 *  disabled: boolean
 *  loading: boolean
 * 	message: string
 *  onInput: (f: (value: T, { trusted: bool }) => void) => void
 * }} AutocompleteInputInstance
 */

/**
 * @template {Model} T
 * @typedef {(search: string) => Promise<T[]>} AutocompleteInputFetch<T>
 */

/**
 * @template {Model} T
 * @typedef {(item: T) => { value: number|string, label: string|HTMLElement, badge: ?HTMLElement }} AutocompleteInputProcess<T>
 */

/**
 * Create autocomplete input that support server-side searching.
 *
 * @template	{Model}									T
 * @param		{object}								options
 * @param		{string}								options.id
 * @param		{string}								options.label
 * @param		{string}								options.color
 * @param		{boolean}								options.required
 * @param		{boolean}								options.multiple
 * @param		{boolean}								options.animated
 * @param		{boolean}								options.fixed
 * @param		{number}								options.searchTimeout
 * @param		{AutocompleteInputFetch<T>}				options.fetch
 * @param		{AutocompleteInputProcess<T>}			options.process
 * @param		{(value, { trusted: bool }) => void}	options.onInput
 * @return		{AutocompleteInputInstance<T>}
 */
function createAutocompleteInput({
	id,
	label,
	color = "blue",
	required = false,
	multiple = false,
	animated = false,
	fixed = true,
	searchTimeout = 500,
	fetch = () => [],
	process = (i) => i,
	withEnableSwitch = false,
	onInput = null
} = {}) {
	const input = createInput({
		type: "text",
		id,
		label,
		color,
		autofill: false,
		animated,
		required,
		withEnableSwitch
	});

	input.group.classList.add("sq-autocomplete");
	const selects = document.createElement("span");
	selects.classList.add("selects");
	input.group.insertBefore(selects, input.input);

	const spinner = document.createElement("div");
	spinner.classList.add("simpleSpinner");

	const panel = document.createElement("div");
	panel.classList.add("select-panel");

	const inner = document.createElement("div");
	inner.classList.add("inner");
	panel.appendChild(inner);

	if (!fixed) {
		input.group.classList.add("dynamic");

		(new ResizeObserver(() => {
			input.group.style.setProperty("--bottom-space", `calc(0.5rem + ${panel.clientHeight}px)`);
		})).observe(panel);
	}

	new Scrollable(panel, {
		content: inner,
		scrollout: false,
		distance: 0.5,
		velocity: 1
	});

	const empty = makeTree("div", "message", {
		icon: { tag: "icon", icon: "search" },
		label: { tag: "label", text: app.string("no_result_title") },
		sub: { tag: "div", text: app.string("no_result_sub") }
	});

	const error = makeTree("div", "message", {
		icon: { tag: "icon", icon: "exclamation" },
		label: { tag: "label", text: "Unknown Error" },
		sub: { tag: "div", text: "An unknown error occured! Please try again later." },
		report: ScreenUtils.renderLink(app.string("response.errorReport"), "#", { newTab: true })
	});

	inner.appendChild(empty);

	let timeout = null;
	let fetched = {};
	let activates = [];
	let badges = [];
	let showing = false;
	let inputListeners = [];
	let isDisabled = false;

	if (typeof onInput === "function")
		inputListeners.push(onInput);

	document.body.addEventListener("click", (e) => {
		if (input.group.contains(e.target) || badges.includes(e.target))
			return;

		hideSelectPanel();
	});

	input.input.addEventListener("focus", async () => {
		if (showing || isDisabled)
			return;

		input.group.appendChild(panel);

		await nextFrameAsync();

		if (!fixed)
			input.group.style.setProperty("--bottom-space", `12.5rem`);

		panel.classList.add("display");
		showing = true;
		await search(input.value);
	});

	input.input.addEventListener("keydown", async () => {
		if (searchTimeout <= 0) {
			search(input.value);
		} else {
			clearTimeout(timeout);
			timeout = setTimeout(() => search(input.value), 500);
		}
	});

	const update = (trusted = false) => {
		let inputted = activates.length > 0;
		input.group.classList[inputted ? "add" : "remove"]("inputting");

		if (required)
			input.input.required = !inputted;

		inputListeners.forEach((f) => f(instance.value, { trusted }));
	};

	const hideSelectPanel = () => {
		if (!showing)
			return;

		if (!fixed)
			input.group.style.setProperty("--bottom-space", `0`);

		showing = false;
		panel.classList.remove("display");
		input.group.removeChild(panel);
		input.value = "";
	}

	const deactivateAll = (trusted = false, triggerUpdate = true) => {
		let i = activates.length;

		while (i--)
			activates[i].deactivate(trusted, false);

		activates = [];

		if (triggerUpdate) {
			update(trusted);
		} else {
			input.group.classList.remove("inputting");

			if (required)
				input.input.required = true;
		}
	};

	const search = async (search) => {
		input.group.appendChild(spinner);
		input.value = search;

		try {
			let items = await fetch(search);
			items = items.map((i) => ({ instance: i, ...process(i) }));

			if (inner.contains(error))
				inner.removeChild(error);

			setItems(items);
		} catch (e) {
			clog("WARN", `createAutocompleteInput() [search()]: handing fetch resulted in an error:`, e);

			const { code, description } = parseException(e);
			error.label.innerText = code;
			error.sub.innerHTML = description;

			if (e.data && e.data.report) {
				error.report.style.display = null;
				error.report.href = e.data.report;
			} else {
				error.report.style.display = "none";
			}

			inner.appendChild(error);

			if (inner.contains(empty))
				inner.removeChild(empty);
		}

		if (input.group.contains(spinner))
			input.group.removeChild(spinner);
	}

	const setItems = (items, selected = false) => {
		emptyNode(inner);

		if (!items || items.length === 0) {
			if (!selected) {
				inner.appendChild(empty);
			} else {
				update();
			}

			return;
		}

		let updateAfter = false;

		for (let item of items) {
			if (fetched[item.value]) {
				fetched[item.value].label(item.label);
				inner.appendChild(fetched[item.value].node);

				if (selected) {
					if (multiple) {
						fetched[item.value].activate(false, false);
						updateAfter = true;
					} else {
						fetched[item.value].activate();
					}
				}

				continue;
			}

			let node = document.createElement("div");
			node.classList.add("item");
			node.dataset.value = item.value;

			let badge = document.createElement("span");
			badge.classList.add("badge");
			badges.push(badge);

			const label = (label, badgeView = null) => {
				item.label = label;

				if (isElement(label)) {
					emptyNode(node);
					emptyNode(badge);
					badge.classList.add("node");

					node.appendChild(label);
					badge.appendChild(badgeView ? badgeView : label.cloneNode(true));
				} else {
					badge.classList.remove("node");
					node.innerHTML = label;
					badge.innerHTML = label;
				}
			};

			label(item.label, item.badge);
			let activated = false;

			const activate = (trusted = false, triggerUpdate = true) => {
				if (!multiple)
					deactivateAll(trusted, false);

				activates.push(instance);
				node.classList.add("selected");
				selects.appendChild(badge);
				activated = true;

				if (triggerUpdate)
					update(trusted);
			};

			const deactivate = (trusted = false, triggerUpdate = true) => {
				let index = activates.indexOf(instance);

				if (index >= 0)
					activates.splice(index, 1);

				node.classList.remove("selected");
				selects.removeChild(badge);
				activated = false;

				if (triggerUpdate)
					update(trusted);
			};

			node.addEventListener("click", () => {
				if (activated) {
					deactivate(true);
					return;
				}

				activate(true);

				if (!multiple && showing)
					hideSelectPanel();
			});

			badge.addEventListener("click", () => {
				if (isDisabled)
					return;

				deactivate(true);
			});

			let instance = { item, node, badge, label, activate, deactivate };
			fetched[item.value] = instance;
			inner.appendChild(node);

			if (selected) {
				if (multiple) {
					activate(false, false);
					updateAfter = true;
				} else {
					activate();
				}
			}
		}

		if (updateAfter)
			update();
	}

	const instance = {
		group: input.group,
		input: input.input,

		update,

		/**
		 * Get values
		 *
		 * @returns {string|object|null}
		 */
		get value() {
			if (multiple) {
				return activates.map((instance) => {
					return (instance.item.instance)
						? instance.item.instance
						: instance.item.value;
				});
			}

			if (activates[0]) {
				return (activates[0].item.instance)
					? activates[0].item.instance
					: activates[0].item.value;
			}

			return null;
		},

		set value(value) {
			if (value === null) {
				deactivateAll();
				return;
			}

			if (multiple) {
				if (!Array.isArray(value))
					value = [value];

				value = value.map((i) => {
					return { instance: i, ...process(i) };
				});

				deactivateAll(false, false);
				setItems(value, true);
				return;
			}

			if (Array.isArray(value))
				value = value[0];

			value = { instance: value, ...process(value) };
			setItems([value], true);
		},

		get disabled() {
			return isDisabled;
		},

		set disabled(disabled) {
			input.input.disabled = disabled;
			isDisabled = disabled;
		},

		set loading(loading) {
			if (loading)
				input.group.appendChild(spinner);
			else {
				if (input.group.contains(spinner))
					input.group.removeChild(spinner);
			}
		},

		set message(message) {
			input.set({ message });
		},

		/**
		 * Listen for on input event.
		 *
		 * @param   {(value, { trusted: bool }) => void}    f
		 */
		onInput(f) {
			inputListeners.push(f);
		}
	}

	new MutationObserver(() => {
		isDisabled = input.disabled;

		if (input.disabled && showing)
			hideSelectPanel();
	}).observe(input.input, {
		subtree: false,
		childList: false,
		attributes: true,
		attributeFilter: ["disabled"]
	});

	return instance;
}

/**
 * Disable all input inside a form
 *
 * @param	{HTMLFormElement}		form
 */
function disableInputs(form) {
	for (const input of form.elements) {
		if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
			if (input.classList.contains("form-disabled-input") || input.classList.contains("disabled"))
				continue;

			if (input.disabled) {
				input.classList.add("input-already-disabled");
				continue;
			}

			input.classList.add("form-disabled-input");
			input.disabled = true;
		}
	}
}

/**
 * Enable all input inside a form
 *
 * @param	{HTMLFormElement}		form
 */
function enableInputs(form) {
	for (const input of form.elements) {
		if (input.classList.contains("disabled"))
			continue;

		if (input.classList.contains("input-already-disabled")) {
			input.classList.remove("input-already-disabled");
			continue;
		}

		// Only enable input that don't have disabled class.
		// This is for input that don't want to be enabled.
		if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
			input.classList.remove("form-disabled-input");
			input.disabled = false;
		}
	}
}

/**
 * Calculate and return variance of an array.
 *
 * @param	{number[]}	data
 * @returns	{number}
 */
function calculateVariance(data) {
	const mean = data.reduce((sum, value) => sum + value, 0) / data.length;
	const squaredDiff = data.map(value => Math.pow(value - mean, 2));
	const variance = squaredDiff.reduce((sum, value) => sum + value, 0) / data.length;
	return variance;
}

/**
 * Return the first item that satisfy the check function.
 *
 * @template	{any}						T
 * @param		{T[]}						list
 * @param		{(item: T) => boolean}		check
 * @returns		{?T}
 */
function firstOf(list, check) {
	for (const item of list) {
		if (check(item))
			return item;
	}

	return null;
}

const tooltip = {
	/** @type {HTMLElement} */
	container: undefined,

	/** @type {HTMLElement} */
	content: undefined,

	active: undefined,

	showing: false,
	hideTimeout: undefined,

	/**
	 * Initialize tooltip module for current page.
	 */
	init() {
		this.container = document.createElement("div");
		this.container.classList.add("tooltip");

		this.content = document.createElement("div");
		this.content.classList.add("content");

		app.root.appendChild(this.container);
	},

	/**
	 * Register showing tooltip for a element.
	 *
	 * @param	{HTMLElement|object}							element
	 * @param	{string|HTMLElement|() => string|HTMLElement}	content
	 * @param	{object}										options
	 * @param	{"top" | "bottom" | "left" | "right"}			options.position
	 * @param	{number}										options.spacing
	 */
	register(element, content, {
		position = "top",
		spacing = 8
	} = {}) {

		if (!isElement(element)) {
			if (isElement(element.container))
				element = element.container;
			else if (isElement(element.group))
				element = element.group;
			else
				throw new Error(`tooltip.register(): HTMLElement expected, got ${typeof element} instead!`);
		}

		const instance = {
			element,
			content,
			position,
			spacing
		};

		element.addEventListener("mouseenter", () => {
			let c = (typeof content === "function")
				? content()
				: content;

			if (isElement(c)) {
				emptyNode(this.content);
				this.content.appendChild(c);
			} else {
				// Just treat them as string.
				this.content.innerHTML = c;
			}

			// Calculate position.
			let box = element.getBoundingClientRect();
			let top = 0;
			let left = 0;

			switch (position) {
				case "top": {
					top = box.y - spacing;
					left = box.x + (box.width / 2);
					break;
				}

				case "left": {
					top = box.y + (box.height / 2);
					left = box.x - spacing;
					break;
				}

				case "bottom": {
					top = box.y + box.height + spacing;
					left = box.x + (box.width / 2);
					break;
				}

				case "right": {
					top = box.y + (box.height / 2);
					left = box.x + box.width + spacing;
					break;
				}
			}

			this.active = instance;
			this.show({ x: left, y: top, position });
		});

		element.addEventListener("mouseleave", () => {
			this.hide();
		});
	},

	async show({ x, y, position = "top" } = {}) {
		if (this.showing)
			return;

		this.showing = true;

		this.container.style.left = `${x}px`;
		this.container.style.top = `${y}px`;
		this.container.setAttribute("position", position);

		if (!this.hideTimeout) {
			this.container.appendChild(this.content);
			this.container.classList.add("display");
			await nextFrameAsync();
		} else {
			clearTimeout(this.hideTimeout);
		}

		this.container.classList.add("show");
	},

	async hide() {
		if (!this.showing)
			return;

		this.showing = false;
		clearTimeout(this.hideTimeout);
		this.container.classList.remove("show");

		this.hideTimeout = setTimeout(() => {
			this.container.classList.remove("display");
			this.hideTimeout = null;

			this.container.removeChild(this.content);
		}, 500);
	}
}

class SmoothValue {
	/**
	 * Create a new smooth value element.
	 *
	 * @param	{object}				options
	 * @param	{string|string[]}		classes
	 * @param	{number}				duration	Animation duration, in seconds.
	 * @param	{(number) => number}	timing		Timing functions, see {@link Easing}.
	 */
	constructor({
		classes = [],
		duration = 1,
		timing = Easing.OutExpo,
		decimal = 0
	} = {}) {
		if (typeof classes === "string")
			classes = [classes];

		this.container = document.createElement("span");
		this.container.classList.add("smooth-value", ...classes);

		this.duration = duration;
		this.timing = timing;
		this.decimal = decimal;

		/** @type {Animator} */
		this.animator = null;

		this.currentValue = 0;
		this.container.innerText = this.currentValue.toFixed(this.decimal);
	}

	set value(value) {
		this.set(value);
	}

	async set(value) {
		if (this.animator) {
			this.animator.cancel();
			this.animator = null;
		}

		if (this.currentValue === value)
			return this;

		let start = this.currentValue;
		let delta = (value - this.currentValue);

		this.animator = new Animator(this.duration, this.timing, (t) => {
			this.currentValue = start + (delta * t);
			this.container.innerText = this.currentValue.toFixed(this.decimal);
		});

		await this.animator.complete();
		return this;
	}
}

class IntervalUpdater {
	/**
	 * Create a new interval updater that do an async task without piling
	 * requests when network connection is unstable.
	 *
	 * @param	{object}				[options]
	 * @param	{number}				[options.interval]
	 * @param	{() => Promise<void>}	[options.callback]
	 */
	constructor({
		interval = 1,
		callback = async () => {}
	} = {}) {
		this.beforeUpdateHandler = () => {};
		this.updatedHandler = () => {};
		this.erroredHandler = () => {};
		this.running = false;
		this.timeout = null;
		this.lastCall = null;
		this.interval = interval;
		this.callback = callback;

		this.loading = false;
		this.pRuntime = 0;
		this.errors = 0;

		/** @type {TreeDOM} */
		this.healthNode = null;
	}

	health() {
		if (this.healthNode)
			return this.healthNode;

		this.healthNode = makeTree("div", "intup-health", {
			loading: { tag: "span", class: ["simpleSpinner", "icon"] },
			variation: { tag: "icon", class: "icon", icon: "hourglassClock" },
			latency: { tag: "icon", class: "icon", icon: "wifiExclamation" },
			errors: { tag: "icon", class: "icon", icon: "exclamation" }
		});

		this.callbackGuard = null;
		this.samples = [];
		tooltip.register(this.healthNode.loading, app.string("intup.loading"));

		this.variation = false;
		this.variationText = document.createElement("span");
		tooltip.register(this.healthNode.variation, this.variationText);

		this.latency = false;
		this.latencyText = document.createElement("span");
		tooltip.register(this.healthNode.latency, this.latencyText);

		this.errorText = document.createElement("span");
		tooltip.register(this.healthNode.errors, this.errorText);

		return this.healthNode;
	}

	/**
	 * Run before the update was called.
	 *
	 * @param	{() => void}	f
	 * @returns	{this}
	 */
	onBeforeUpdate(f) {
		this.beforeUpdateHandler = f;
		return this;
	}

	/**
	 * Run after an update was completed successfully.
	 *
	 * @param	{(data) => void}	f
	 * @returns	{this}
	 */
	onUpdated(f) {
		this.updatedHandler = f;
		return this;
	}

	/**
	 * Run after an update generated an error.
	 *
	 * @param	{(error: Error) => void}	f
	 * @returns	{this}
	 */
	onErrored(f) {
		this.updatedHandler = f;
		return this;
	}

	start() {
		if (this.running)
			return this;

		this.running = true;
		this.update();
		return this;
	}

	async update() {
		if (!this.running)
			return;

		let start = performance.now();
		this.loading = true;
		this.beforeUpdateHandler();

		if (this.healthNode) {
			this.callbackGuard = setTimeout(() => {
				this.healthNode.loading.classList.add("display");
			}, (this.interval * 0.6) * 1000);
		}

		try {
			let data = await this.callback();
			this.updatedHandler(data);
		} catch (e) {
			this.errors += 1;
			this.healthNode.errors.classList.add("display");
			this.healthNode.errors.dataset.level = (this.errors > 2) ? "critical" : "warning";
			this.errorText.innerText = app.string("intup.errors", { count: this.errors });

			clog("WARN", `IntervalUpdater().update() generated an error while handing callback: `, e);
			this.erroredHandler(e);
		}

		this.loading = false;

		if (this.healthNode) {
			this.healthNode.loading.classList.remove("display");
			clearTimeout(this.callbackGuard);
		}

		// Safeguard.
		if (!this.running)
			return;

		let runtime = (performance.now() - start) / 1000;
		this.pRuntime = (runtime / this.interval);

		if (this.healthNode) {
			this.samples.push(runtime);

			if (this.samples.length > 5) {
				this.samples.shift();

				let variance = calculateVariance(this.samples);

				if (variance > 0.1) {
					if (!this.variation) {
						this.healthNode.variation.classList.add("display");
						this.variation = true;
					}

					this.healthNode.variation.dataset.level = (variance >= 0.2)
						? "critical"
						: "warning";

					this.variationText.innerText = app.string("intup.variation", {
						variation: (variance * 1000).toFixed(1)
					});
				} else {
					if (this.variation) {
						this.healthNode.variation.classList.remove("display");
						this.variation = false;
					}
				}
			}

			if (this.pRuntime >= 0.6) {
				if (!this.latency) {
					this.healthNode.latency.classList.add("display");
					this.latency = true;
				}

				this.healthNode.latency.dataset.level = (this.pRuntime >= 1)
					? "critical"
					: "warning";

				this.latencyText.innerText = app.string("intup.latency", {
					percent: (this.pRuntime * 100).toFixed(1),
					interval: (this.interval * 1000)
				});
			} else {
				if (this.latency) {
					this.healthNode.latency.classList.remove("display");
					this.latency = false;
				}
			}
		}

		let wait = (this.interval - runtime) * 1000;
		this.timeout = setTimeout(() => this.update(), wait);
	}

	stop() {
		if (!this.running)
			return this;

		this.running = false;
		clearTimeout(this.timeout);
		return this;
	}
}

class Chart {
	/**
	 * @typedef {{
	 * 	index: number
	 * 	value: number
	 * 	color: string
	 * 	data: any
	 * 	group: SVGElement
	 * 	hover: SVGRectElement
	 * 	node: SVGRectElement
	 * 	label: SVGTextElement
	 * 	top: number
	 * 	prevLeft: number
	 * 	left: number
	 * 	height: number
	 * 	update: boolean
	 *	display: boolean
	 * }} ChartBar
	 *
	 * @typedef {{
	 * 	display: boolean
	 *  unit: string
	 *  label: string
	 *	rotateLabel: number
	 *	step: number
	 * 	space: number
	 * 	padding: number
	 * 	format: (value: number) => number|string
	 * 	tipFormat: (value: number) => number|string
	 * 	dimensions: (instance: ChartBar) => ChartDimensionValue[]
	 * 	tip: string|HTMLElement|((bar: ChartBar, chart: Chart) => string|HTMLElement)|null
	 * }} ChartAxis
	 *
	 * @typedef {{
	 * 	group: SVGElement
	 * 	label: SVGTextElement
	 * 	line: SVGLineElement
	 * 	value: number
	 * 	display: boolean
	 * }} ChartLine
	 *
	 * @typedef {{
	 * 	color: string
	 * 	name: string
	 * 	value: number
	 * 	min: number
	 * 	max: number
	 * }} ChartDimensionValue
	 */

	/**
	 * Create a new chart instance.
	 *
	 * @param	{object}											options
	 * @param	{number}											options.spacing
	 * @param	{string}											options.color
	 * @param	{number}											options.history		number of old data points to keep for re-use
	 * @param	{number}											options.transition	Duration of animation.
	 * @param	{string|string[]}									options.classes		Class names to add to chart container.
	 * @param	{{ horizontal: ChartAxis, vertical: ChartAxis }}	options.axis
	 */
	constructor({
		spacing = 8,
		color = "accent",
		history = 100,
		transition = 0.3,
		classes = [],
		axis = {
			horizontal: {},
			vertical: {}
		}
	} = {}) {
		this.container = this.createE("svg", "bechart");

		if (typeof classes === "string")
			this.container.classList.add(classes);
		else if (typeof classes === "object" && classes.length)
			this.container.classList.add(...classes);

		this.hoverDims = [];

		this.hoverNode = makeTree("div", "bachart-hover", {
			timestamp: { tag: "div", class: "timestamp", text: "00/00/0000 00:00" },
			additional: { tag: "div", class: "additional" },

			dimensions: { tag: "div", class: "dimensions", child: {
				header: { tag: "div", class: "header", child: {
					dim: { tag: "span", class: "dimension", text: app.string("chart.dimensions") },
					value: { tag: "span", class: "value", text: app.string("chart.value") }
				}}
			}}
		});

		this.width = 0;
		this.height = 0;
		this.xSpace = 0;
		this.ySpace = 0;
		this.spacing = spacing;
		this.color = color;
		this.xStep = 60;
		this.yStep = 10;
		this.padTop = 10;
		this.history = history;
		this.transition = transition;

		this.validateLayout = false;

		/** @type {{ [index: number]: SVGTextElement }} */
		this.xNodes = {};

		/** @type {ChartLine[]} */
		this.yNodes = {};

		/** @type {ChartAxis} */
		this.vertical = {};

		/** @type {ChartAxis} */
		this.horizontal = {};

		this.max = 0;
		this.min = 0;
		this.graphMax = 0;
		this.graphMin = 0;
		this.axis = axis;

		this.content = this.createE("g", "bars");
		this.container.appendChild(this.content);
		this.container.style.setProperty("--duration", `${this.transition}s`);

		/** @type {{[index: number]: number}} */
		this.prevDisplay = {};

		/** @type {{[index: number]: number}} */
		this.display = {};

		// Update svg size when container is resized.
		(new ResizeObserver(() => this.updateSize()).observe(this.container));
		this.updateSize();

		/** @type {{[index: number|string]: ChartBar}} */
		this.points = {};

		this.pointCount = 0;

		this.setA(this.container, {
			"xmlns:svg": "http://www.w3.org/2000/svg",
			"xmlns": "http://www.w3.org/2000/svg",
			"xmlns:xlink": "http://www.w3.org/1999/xlink",
			version: "1.1"
		});
	}

	/**
	 * Update axis information.
	 *
	 * @param	{{ horizontal: ChartAxis, vertical: ChartAxis }}	axis
	 */
	set axis({ horizontal = {}, vertical = {} } = {}) {
		let doUpdate = false;

		{
			let {
				display = true,
				unit = "count",
				label = "vertical",
				rotateLabel = 0,
				minSize = 0,
				step = 100,
				space = 60,
				padding = 10,
				format = (value) => value,
				tipFormat = (value) => value,
				tip = null
			} = { ...this.vertical, ...vertical };

			this.vertical = { display, unit, label, rotateLabel, minSize, step, space, padding, format, tipFormat, tip };

			if (this.yStep !== step)
				doUpdate = true;

			this.yStep = step;

			// Update current dimension unit in the hover node display.
			this.hoverNode.dimensions.header.value.innerHTML = app.string("chart.value") + ` <code>${unit}</code>`;

			if (display) {
				if (!this.yAxis) {
					this.yAxis = this.createE("g", ["axis", "y"]);
					this.yLabel = this.createE("text", ["label", "y"]);
				}

				if (!this.container.contains(this.yAxis))
					this.container.append(this.yAxis);

				if (this.xSpace !== space) {
					doUpdate = true;
					this.validateLayout = true;
				}

				if (label) {
					this.yLabel.textContent = label;

					if (!this.container.contains(this.yLabel))
						this.container.append(this.yLabel);
				} else {
					if (this.container.contains(this.yLabel))
						this.container.removeChild(this.yLabel);
				}

				this.xSpace = space;
				this.container.style.setProperty(`--pad-top`, `${padding}px`);
				this.container.style.setProperty(`--x-space`, `${space}px`);
				this.container.style.setProperty(`--x-space-2`, `${space / 2}px`);
			} else {
				if (this.yAxis) {
					this.container.removeChild(this.yAxis);
					this.container.removeChild(this.yLabel);
				}

				if (this.xSpace > 0) {
					doUpdate = true;
					this.validateLayout = true;
				}

				this.xSpace = 0;
				this.container.style.setProperty(`--pad-top`, `0px`);
				this.container.style.setProperty(`--x-space`, `0px`);
				this.container.style.setProperty(`--x-space-2`, `0px`);
			}
		}

		{
			let {
				display = true,
				unit = "time",
				label = null,
				rotateLabel = 0,
				minSize = 0,
				step = 60,
				space = 20,
				padding = 10,

				format = (value) => {
					let date = new Date(value * 1000);
					return `${pleft(date.getHours(), 2)}:${pleft(date.getMinutes(), 2)}:${pleft(date.getSeconds(), 2)}`;
				},

				tipFormat = (value) => humanReadableTime(new Date(value * 1000), {
					beautify: true,
					alwayShowSecond: true
				}),

				dimensions = () => [],
				tip = null
			} = { ...this.horizontal, ...horizontal };

			this.horizontal = { display, unit, label, rotateLabel, minSize, step, space, padding, format, tipFormat, dimensions, tip };

			if (this.xStep !== step)
				doUpdate = true;

			this.xStep = step;

			if (display) {
				if (!this.xAxis) {
					this.xAxis = this.createE("g", ["axis", "x"]);
					this.xLabel = this.createE("text", ["label", "x"]);
				}

				if (!this.container.contains(this.xAxis))
					this.container.append(this.xAxis);

				if (this.ySpace !== space) {
					doUpdate = true;
					this.validateLayout = true;
				}

				if (label) {
					this.xLabel.textContent = label;

					if (!this.container.contains(this.xLabel))
						this.container.append(this.xLabel);
				} else {
					if (this.container.contains(this.xLabel))
						this.container.removeChild(this.xLabel);
				}

				this.ySpace = space;
				this.xLabel.textContent = label;
				this.container.style.setProperty(`--y-space`, `${space}px`);
				this.container.style.setProperty(`--y-space-2`, `${space / 2}px`);
			} else {
				if (this.xAxis) {
					this.container.removeChild(this.xAxis);
					this.container.removeChild(this.xLabel);
				}

				if (this.ySpace > 0) {
					doUpdate = true;
					this.validateLayout = true;
				}

				this.ySpace = 0;
				this.container.style.setProperty(`--y-space`, `0px`);
				this.container.style.setProperty(`--y-space-2`, `0px`);
			}
		}

		if (doUpdate) {
			this.updateAxis();
			this.update();
		}
	}

	/**
	 * Set data to be displayed in chart.
	 *
	 * @param	{{[index: number]: number|{ value: number, color: string, data: object }}}	data
	 */
	set data(data) {
		this.prevDisplay = this.display;
		this.display = {};
		let nth = 0;

		this.max = -Infinity;
		this.min = 0;

		for (let [index, value] of Object.entries(data)) {
			if (typeof value !== "object")
				value = { value: parseInt(value) };

			if (value.value > this.max)
				this.max = value.value;

			if (value.value < this.min)
				this.min = value.value;

			this.display[index] = nth++;

			if (this.points[index]) {
				let instance = this.points[index];

				if (instance.value !== value.value)
					instance.value = value.value;

				instance.update = true;
				continue;
			}

			let group = this.createE("g", ["bar", "map-color"]);
			let hover = this.createE("rect", "hover");
			let node = this.createE("rect", "bar");
			group.append(hover, node);

			/** @type {ChartBar} */
			let instance = {
				index,
				value: value.value,
				color: value.color ? value.color : this.color,
				data: value.data,
				group,
				hover,
				node,
				label: null,
				left: 0,
				height: 0,
				update: true,
				display: false
			}

			this.setA(group, {
				index: instance.index,
				color: instance.color
			});

			tooltip.register(group, () => {
				/** @type {ChartDimensionValue[]} */
				let dimensions = [
					{ color: "accent", name: "main", value: instance.value, min: this.min, max: this.max },
					...this.horizontal.dimensions(instance)
				];

				const header = this.hoverNode.dimensions.header;
				emptyNode(this.hoverNode.dimensions);
				this.hoverNode.dimensions.appendChild(header);

				for (let [index, dimension] of dimensions.entries()) {
					if (!this.hoverDims[index]) {
						this.hoverDims[index] = makeTree("div", ["map-color", "dimension", dimension.name], {
							bar: createProgressBar({
								color: dimension.color,
								left: dimension.name
							}),

							value: { tag: "span", class: "value", text: "0" }
						});
					}

					this.hoverDims[index].bar.set({
						left: dimension.name,
						color: dimension.color,
						progress: scaleValue(dimension.value, [dimension.min, dimension.max], [0, 100])
					});

					this.hoverDims[index].value.innerText = this.vertical.tipFormat(dimension.value);
					this.hoverDims[index].setAttribute("color", dimension.color);
					this.hoverNode.dimensions.appendChild(this.hoverDims[index]);
				}

				if (this.vertical.tip !== null) {
					let tip = (typeof this.vertical.tip === "function")
						? this.vertical.tip(instance, this)
						: this.vertical.tip;

					if (isElement(tip)) {
						emptyNode(this.hoverNode.additional);
						this.hoverNode.additional.appendChild(tip);
					} else {
						this.hoverNode.additional.innerHTML = tip;
					}
				}

				this.hoverNode.timestamp.innerHTML = this.horizontal.tipFormat(index);
				return this.hoverNode;
			}, { position: "top" });

			this.points[index] = instance;
			this.pointCount += 1;
		}

		// Clean up old data points.
		let displayCount = Object.keys(this.display).length;
		let pointIndexes = Object.keys(this.points);
		let pointCursor = 0;
		this.history = Math.max(this.history, Math.ceil(displayCount * 1.5));

		while (this.pointCount > this.history) {
			let index = pointIndexes[pointCursor];

			if (typeof this.display[index] !== "undefined") {
				pointCursor += 1;
				continue;
			}

			delete this.points[index];
			this.pointCount -= 1;
			pointCursor += 1;
		}

		this.updateAxis();
		this.update();
	}

	update() {
		if (this.width <= 0 || this.height <= 0)
			return;

		let space = (this.spacing / (this.width - this.xSpace));
		let innerPad = space / 2;
		let left = (this.xSpace / this.width);
		let bLeft = left + innerPad;
		let hLeft = left;
		let count = Object.keys(this.display).length;
		let bWidth = (((this.width - this.xSpace) / count) / this.width) - space + ((space - (innerPad * 2)) * (1 / count));
		let hWidth = bWidth + space;
		let hHeight = 1 - ((this.ySpace + this.padTop) / this.height);
		let topPad = (this.padTop / this.height);
		let topAnchor = 1 - scaleValue(0, [this.graphMin, this.graphMax], [(this.ySpace / this.height) + topPad, 1]) + topPad;

		// Remove old bars.
		for (let [index, instance] of Object.entries(this.points)) {
			if (typeof this.display[index] === "undefined" && instance.display) {
				instance.hover.style.width = "0";
				instance.node.style.width = "0";
				instance.display = false;
				instance.update = false;

				setTimeout(() => {
					this.content.removeChild(instance.group);
				}, this.transition * 1000);

				continue;
			}

			if (instance.update) {
				instance.height = Math.abs((instance.value / (this.graphMax - this.graphMin)) * (1 - ((this.ySpace + this.padTop) / this.height)));

				// Apply min size.
				instance.height = Math.max(instance.height, (this.vertical.minSize / this.height));
				instance.node.style.height = (instance.height * 100) + "%";
			}
		}

		// Add new bars / update existing bars.
		for (let index of Object.keys(this.display)) {
			let instance = this.points[index];
			let isNewPoint = (typeof this.prevDisplay[index] === "undefined");

			instance.hover.style.width = (hWidth * 100) + "%";
			instance.hover.style.height = (hHeight * 100) + "%";
			instance.hover.style.y = (topPad * 100) + "%";

			instance.left = bLeft;
			instance.top = (instance.value >= 0)
				? (topAnchor - instance.height)
				: topAnchor;

			instance.node.style.width = (bWidth * 100) + "%";
			instance.node.style.y = (instance.top * 100) + "%";

			if (isNewPoint) {
				let hL = hLeft + hWidth;
				let bL = bLeft + (bWidth + space);

				instance.hover.style.x = (hL * 100) + "%";
				instance.node.style.x = (bL * 100) + "%";

				if (!instance.display) {
					this.content.appendChild(instance.group);
					instance.display = true;
				}

				requestAnimationFrame(() => {
					hL -= hWidth;
					bL -= (bWidth + space);
					instance.hover.style.x = (hL * 100) + "%";
					instance.node.style.x = (bL * 100) + "%";
				});
			} else {
				instance.hover.style.x = (hLeft * 100) + "%";
				instance.node.style.x = (instance.left * 100) + "%";

				if (!instance.display) {
					this.content.appendChild(instance.group);
					instance.display = true;
				}
			}

			// Add label below if available.
			if (this.xAxis && this.horizontal.display) {
				let lY = hHeight + topPad;

				if ((this.horizontal.step <= 1) || (index % this.horizontal.step === 0)) {
					if (!instance.label) {
						instance.label = this.createE("text");
						instance.label.textContent = this.horizontal.format(index);
						this.xNodes[index] = instance.label;

						if (this.horizontal.rotateLabel !== 0) {
							instance.label.classList.add(
								"rotated",
								(this.horizontal.rotateLabel > 0)
									? "rotate-cw"
									: "rotate-ccw"
							);
						}
					}

					const rotate = (this.horizontal.rotateLabel !== 0)
						? ` rotate(${this.horizontal.rotateLabel}deg)`
						: "";

					if (isNewPoint) {
						let hL = hLeft + (hWidth / 2) + hWidth;
						instance.label.style.transform = `translate(${hL * 100}%, ${lY * 100}%)${rotate}`;

						requestAnimationFrame(() => {
							hL -= hWidth;
							instance.label.style.transform = `translate(${hL * 100}%, ${lY * 100}%)${rotate}`;
						});
					} else {
						instance.label.style.transform = `translate(${(hLeft + (hWidth / 2)) * 100}%, ${lY * 100}%)${rotate}`;
					}

					if (!this.xAxis.contains(instance.label))
						this.xAxis.append(instance.label);
				} else {
					if (instance.label && this.xAxis.contains(instance.label)) {
						this.xAxis.removeChild(instance.label);
						delete this.xNodes[index];
					}
				}

				for (let [index, node] of Object.entries(this.xNodes)) {
					if (typeof this.display[index] !== "undefined")
						continue;

					this.xAxis.removeChild(node);
					delete this.xNodes[index];
				}
			}

			hLeft += hWidth;
			bLeft += (bWidth + space);
		}

		this.prevDisplay = this.display;
	}

	updateSize() {
		this.width = this.container.clientWidth;
		this.height = this.container.clientHeight;
		this.container.style.setProperty(`--width`, `${this.width}px`);
		this.container.style.setProperty(`--height`, `${this.height}px`);
		this.setAttrNS(this.container, "viewBox", `0 0 ${this.width} ${this.height}`);

		this.updateAxis();
		this.update();
	}

	updateAxis() {
		if (this.width <= 0 || this.height <= 0)
			return;

		if (this.yAxis && this.vertical.display) {
			let ticks = Math.round(this.height / this.yStep) + 1;
			let steps = this.steps(this.min, this.max, ticks);

			let sMax = steps[steps.length - 1];
			let sMin = steps[0];

			if (sMax !== this.graphMax || sMin !== this.graphMin) {
				this.graphMax = sMax;
				this.graphMin = sMin;

				for (let [index, step] of steps.entries()) {
					if (!this.yNodes[index]) {
						let group = this.createE("g");
						let label = this.createE("text");
						let line = this.createE("line");
						group.append(label, line);

						this.setA(label, {
							x: `${this.xSpace}px`,
							y: `0px`
						});

						this.setA(line, {
							x1: `${this.xSpace}px`,
							x2: `100%`,
							y1: `0px`,
							y2: `0px`
						});

						this.yNodes[index] = {
							group,
							label,
							line,
							value: null,
							display: false
						}
					}

					if (!this.yNodes[index].display) {
						this.yAxis.append(this.yNodes[index].group);
						this.yNodes[index].display = true;
					}

					let topPad = (this.padTop / this.height);
					let pos = 1 - scaleValue(step, [sMin, sMax], [(this.ySpace / this.height) + topPad, 1]) + topPad;

					if (this.validateLayout) {
						this.setA(this.yNodes[index].label, {
							x: `${this.xSpace}px`
						});

						this.setA(this.yNodes[index].line, {
							x1: `${this.xSpace}px`
						});
					}

					this.yNodes[index].label.style.transform = `translateY(${pos * 100}%)`;
					this.yNodes[index].line.style.transform = `translateY(${pos * 100}%)`;

					if (this.yNodes[index].value !== step) {
						this.yNodes[index].label.textContent = this.vertical.format(step);
						this.yNodes[index].value = step;
					}
				}

				for (let index = steps.length; index < this.yNodes.length; index++) {
					if (!this.yNodes[index].display)
						continue;

					this.yAxis.removeChild(this.yNodes[index].group);
					this.yNodes[index].display = false;
				}

				this.validateLayout = false;
			}
		} else {
			this.graphMax = Math.max(this.max, 1);
			this.graphMin = this.min;
		}

		if (this.xAxis && this.horizontal.display) {
			// TODO: update axis here when vertical axis has implemented
			// TODO: relative value position like horizontal axis.
		}
	}

	/**
	 * Return steps array for each line.
	 *
	 * @param	{number}	min
	 * @param	{number}	max
	 * @param	{number}	ticks
	 * @returns {number[]}
	 */
	steps(min, max, ticks) {
		const range = max - min;

		if (range === 0)
			return [0, 1];

		const roughStep = range / ticks;
		const magnitude = Math.floor(Math.log10(roughStep));
		const power = Math.pow(10, magnitude);
		const niceFraction = roughStep / power;

		let niceStep;
		let steps = [];

		if (niceFraction <= 1.0)
			niceStep = 1 * power;
		else if (niceFraction <= 2.0)
			niceStep = 2 * power;
		else if (niceFraction <= 5.0)
			niceStep = 5 * power;
		else
			niceStep = 10 * power;

		if (min < 0) {
			for (let step = -niceStep; ; step -= niceStep) {
				steps.unshift(step);

				if (step < min)
					break;
			}
		}

		for (let step = 0; ; step += niceStep) {
			steps.push(step);

			if (step > max)
				break;
		}

		return steps;
	}

	/**
	 * Create a new element in the svg namespace.
	 *
	 * @param	{string}			tag
	 * @param	{string|string[]}	classes
	 * @returns {SVGElement}
	 */
	createE(tag, classes) {
		const node = document.createElementNS("http://www.w3.org/2000/svg", tag);

		if (classes) {
			if (typeof classes === "string")
				classes = [classes];

			node.classList.add(...classes);
		}

		return node;
	}

	setA(node, attributes) {
		for (let key of Object.keys(attributes))
			node.setAttribute(key, attributes[key]);
	}

	setAttrNS(node, key, value) {
		node.setAttributeNS("http://www.w3.org/2000/svg", key, value);
	}
}

class Timeline {
	/**
	 * Create a new timeline chart instance.
	 *
	 * @param	{object}				options
	 * @param	{string|string[]}		options.classes		Class names to add to chart container.
	 */
	constructor({
		classes = []
	} = {}) {
		this.container = makeTree("div", "betimeline", {

		});

		if (typeof classes === "string")
			this.container.classList.add(classes);
		else if (typeof classes === "object" && classes.length)
			this.container.classList.add(...classes);
	}
}

class ScreenUtils {
	/**
	 * Render boolean indicator.
	 *
	 * @param   {boolean}		value
	 * @param   {string[]}		icons
	 * @returns {HTMLElement}
	 */
	static renderBoolean(value, {
		icons = ["circleCheck", "circleXMark"],
		colors = ["green", "red"]
	} = {}) {
		let icon = (value) ? icons[0] : icons[1];
		let color = (value) ? colors[0] : colors[1];

		const node = ScreenUtils.renderIcon(icon, { color, style: "regular" });
		node.classList.add("screen-bool", (value) ? "true" : "false");
		return node;
	}

	/**
	 * @typedef {"OKAY" | "INFO" | "WARN" | "ERROR"} ScreenStatuses
	 */

	/**
	 * Render status indicator.
	 *
	 * @param   {ScreenStatuses}																	status
	 * @param   {?string|{[status: ScreenStatuses]: string}|(status: ScreenStatuses) => string}		label
	 */
	static renderStatus(status, label = null) {
		status = status.toUpperCase();
		const icon = {
			"OKAY": "circleCheck",
			"INFO": "circleInfo",
			"WARN": "triangleExclamation",
			"ERROR": "circleXMark"
		}[status];

		if (label && typeof label === "object")
			label = label[status];
		else if (typeof label === "function")
			label = label(status);
		else if (label === true)
			label = status;

		const node = makeTree("div", "screen-status", {
			icon: { tag: "icon", icon },
			label: (label)
				? { tag: "span", class: "label", text: label }
				: null
		});

		node.dataset.status = status;
		return node;
	}

	/**
	 * Render readable date from unix timestamp.
	 *
	 * @param   {number}        time
	 * @param   {boolean}       includeRelative
	 * @returns {HTMLElement}
	 */
	static renderDate(time, includeRelative = false) {
		const node = document.createElement("div");
		node.classList.add("screen-date");

		node.innerHTML = humanReadableTime(new Date(time * 1000), {
			beautify: true
		});

		if (includeRelative) {
			let rel = relativeTime(time, {
				returnNode: true
			});

			node.appendChild(rel);
		}

		return node;
	}

	/**
	 * Render readable date from unix timestamp.
	 *
	 * @param   {string|HTMLElement}	display
	 * @param   {string|(() => void)}	link
	 * @param   {object}				options
	 * @param   {boolean}				options.newTab		Open link in new tab.
	 * @param   {boolean}				options.isExternal	Is target link external from current screen.
	 * @param   {string}				options.color		Link color.
	 * @returns {HTMLElement}
	 */
	static renderLink(display, link = () => {}, { newTab = false, isExternal = true, color = "accent" } = {}) {
		const node = makeTree("a", ["map-color", "screen-link"], {
			display: { tag: "span", class: "display" },
			icon: (isExternal)
				? { tag: "icon", icon: "externalLink" }
				: null
		});

		node.dataset.color = color;

		if (isElement(display)) {
			node.display.appendChild(display);
		} else {
			node.display.innerHTML = display;
		}

		if (link) {
			if (typeof link === "string") {
				node.href = link;
	
				if (newTab) {
					node.target = "_blank";
					node.rel = "nofollow";
				}
	
				return node;
			}
	
			node.addEventListener("click", () => link());
		}

		return node;
	}

	/**
	 * Render user profile.
	 *
	 * @param   {string}    fullname
	 * @param   {?string}   image
	 * @param   {?string}   link
	 * @returns {HTMLElement}
	 */
	static renderUser(fullname, image = null, link = null) {
		const node = makeTree("div", "screen-user", {
			image: (image)
				? new lazyload({ source: image, classes: "user-image" })
				: null,

			fullname: (link)
				? this.renderLink(fullname, link, { newTab: true })
				: { tag: "span", class: "fullname", text: fullname }
		});

		return node;
	}

	/**
	 * Render empty value indicator
	 *
	 * @returns {HTMLElement}
	 */
	static renderEmpty() {
		const node = document.createElement("span");
		node.classList.add("screen-empty-value");
		node.innerText = "–";

		return node;
	}

	/**
	 * Render multi-line, mini instance display to reduce horizontal space taken
	 * in table.
	 *
	 * @param	{string|HTMLElement}			name
	 * @param	{string[]|HTMLElement[]}		dependencies
	 * @returns	{HTMLElement}
	 */
	static renderInstanceDisplay(name, dependencies = []) {
		const node = document.createElement("span");
		node.classList.add("screen-instance-display");

		for (const dependency of dependencies) {
			if (isElement(dependency)) {
				dependency.classList.add("dependency");
				node.appendChild(dependency);
				continue;
			}

			const item = document.createElement("div");
			item.classList.add("dependency");
			item.innerText = dependency;
			node.appendChild(item);
		}

		if (isElement(name)) {
			name.classList.add("instance-name");
			node.appendChild(name);
		} else {
			const nameNode = document.createElement("div");
			nameNode.classList.add("instance-name");
			nameNode.innerText = name;
			node.appendChild(nameNode);
		}

		return node;
	}

	/**
	 * Render badge.
	 *
	 * @param	{string}		content
	 * @param	{string}		color
	 * @param	{?string}		[icon]
	 * @returns {HTMLElement}
	 */
	static renderBadge(content, color = "default", icon = null) {
		const node = makeTree("span", ["screen-badge", "map-color"], {
			icon: (icon)
				? { tag: "icon", icon }
				: null,

			label: { tag: "span", class: "label", html: content }
		});

		node.dataset.color = color;
		return node;
	}

	/**
	 * Render progress bar.
	 *
	 * @param	{number}		value
	 * @param	{number}		[max]
	 * @param	{object}		options
	 * @param	{number}		[options.decimal]
	 * @param	{string}		[options.color]
	 * @returns {HTMLElement & { value: number, max: number }}
	 */
	static renderProgress(value, max = 100, { decimal = 0, color = "accent" } = {}) {
		const node = makeTree("span", ["screen-progress", "map-color"], {
			bar: { tag: "span", class: "bar", child: {
				inner: { tag: "div", class: "inner" }
			}},

			valueNode: { tag: "span", class: "value" }
		});

		let currentValue = value,
			currentMax = max;

		const update = () => {
			const progress = (currentMax > 0)
				? (currentValue / currentMax) * 100
				: 0;

			node.bar.inner.style.width = `${progress}%`;
			node.valueNode.innerHTML = `<b>${currentValue.toFixed(decimal)}</b> / ${currentMax.toFixed(decimal)}`;
		}

		Object.defineProperty(node, "value", {
			get: () => currentValue,

			set: (newValue) => {
				currentValue = newValue;
				update();
			}
		});

		Object.defineProperty(node, "max", {
			get: () => currentMax,

			set: (newValue) => {
				currentMax = newValue;
				update();
			}
		});

		update();
		node.dataset.color = color;
		return node;
	}

	/**
	 * Render parallelogram.
	 *
	 * @param	{string}		label
	 * @param	{string}		content
	 * @param	{string}		color
	 * @param	{?string}		[icon]
	 * @returns {HTMLElement}
	 */
	static renderParallelogram(label, content, color = "default", icon = null) {
		const node = makeTree("span", ["parallelogram", "screen-parallelogram"], {
			label: { tag: "span", class: "label", child: {
				icon: (icon)
					? { tag: "icon", icon }
					: null,

				text: { tag: "span", html: label }
			}},

			value: { tag: "span", class: ["parallelogram", "map-color"], html: content }
		});

		node.value.dataset.color = color;
		return node;
	}

	/**
	 * Render an icon with given name
	 *
	 * @param	{string}									icon
	 * @param	{object}									options
	 * @param	{string}									options.color
	 * @param	{"solid" | "regular" | "light" | "thin"}	options.style
	 * @param	{string|string[]}							[options.classes]
	 * @returns	{HTMLElement}
	 */
	static renderIcon(icon, {
		color = undefined,
		style = "solid",
		classes = undefined
	} = {}) {
		const node = document.createElement("icon");
		node.classList.add(`style-${style}`);
		node.dataset.icon = icon;

		if (color) {
			node.classList.add("map-color");
			node.dataset.color = color;
		}

		if (classes) {
			if (typeof classes === "object" && classes.length)
				node.classList.add(...classes);
			else if (typeof classes === "string")
				node.classList.add(classes);
		}

		return node;
	}

	/**
	 * Render a group of buttons
	 *
	 * @param	{...SQButton}	buttons
	 * @returns	{HTMLElement}
	 */
	static buttonGroup(...buttons) {
		const group = document.createElement("span");
		group.classList.add("sq-btn-group");

		for (const [index, item] of buttons.entries()) {
			group.appendChild(item);

			if (index < buttons.length - 1) {
				const separator = document.createElement("span");
				separator.classList.add("separator");
				group.appendChild(separator);
			}
		}

		return group;
	}

	/**
	 * Add elements into a spaced flex row
	 *
	 * @param 		{...HTMLElement|string}		items
	 * @returns		{HTMLElement}
	 */
	static renderFlexRow(...items) {
		const container = document.createElement("div");
		container.classList.add("flex", "flex-row", "gap-05", "align-items-center");

		for (let item of items) {
			if (typeof item === "string" && item.length > 0) {
				const node = document.createElement("span");
				node.innerText = item;
				item = node;
			}

			if (!isElement(item))
				continue;

			container.appendChild(item);
		}

		return container;
	}

	/**
	 * Add elements into a spaced flex column
	 *
	 * @param 		{...HTMLElement|string}		items
	 * @returns		{HTMLElement}
	 */
	static renderFlexColumn(...items) {
		const container = document.createElement("div");
		container.classList.add("flex", "flex-col", "gap-05");

		for (let item of items) {
			if (typeof item === "string" && item.length > 0) {
				const node = document.createElement("span");
				node.innerText = item;
				item = node;
			}

			if (!isElement(item))
				continue;

			container.appendChild(item);
		}

		return container;
	}

	/**
	 * Add elements into a spaced flex row
	 *
	 * @param 		{...HTMLElement|string}		items
	 * @returns		{HTMLElement}
	 */
	static renderSpacedRow(...items) {
		const container = document.createElement("div");
		container.classList.add("screen-spaced-element-row");

		for (let item of items) {
			if (typeof item === "string" && item.length > 0) {
				const node = document.createElement("span");
				node.innerText = item;
				item = node;
			}

			if (!isElement(item))
				continue;

			container.appendChild(item);
		}

		return container;
	}

	/**
	 * @typedef {HTMLElement & {
	 *	set: (options: {display: string|object|HTMLElement, tip: string?, clip: string?}) => void
	 * }} ScreenCopyableTextView
	 */

	/**
	 * Display content that have copyable value.
	 *
	 * @param	{object}						options
	 * @param	{string|object|HTMLElement}		options.display
	 * @param	{"default" | "codeblock"}		options.style
	 * @param	{string?}						[options.tip]			The text that will display in tooltip when user hover
	 * @param	{string?}						[options.clip]			The text that will be copied into the clipboard
	 * @param	{boolean}						[options.wholeView]		Make the whole view clickable to copy instead of the copy icon only
	 * @returns	{ScreenCopyableTextView}
	 */
	static renderCopyableText({
		display,
		style = "default",
		tip = undefined,
		clip = undefined,
		wholeView = false
	}) {
		const view = makeTree("span", "screen-copyable-text", {
			copy: { tag: "icon", icon: "copy", class: "copy" },
			display: { tag: "span", class: "display" }
		});

		view.dataset.style = style;

		if (wholeView)
			view.classList.add("copyable-view");

		let tipContent = app.string("clipboard_copy");
		let clipContent;
		let resetCopyButton;

		const tooltipContent = document.createElement("div");
		tooltipContent.innerText = tipContent;
		tooltip.register(wholeView ? view : view.copy, tooltipContent, { position: "top" });

		const set = ({
			display,
			tip,
			clip = undefined
		}) => {
			if (isElement(display)) {
				// Only re-append value node if it's not already in
				// value display node.
				if (!view.display.contains(display)) {
					emptyNode(view.display);
					view.display.appendChild(display);
				}
			} else if (display === undefined) {
				emptyNode(view.display);

				if (view.contains(view.display)) {
					view.removeChild(view.display);
					view.classList.add("no-display");
				}
			} else {
				if (!view.contains(view.display)) {
					view.appendChild(view.display);
					view.classList.remove("no-display");
				}

				if (display === null || display === "") {
					emptyNode(view.display);
					view.display.appendChild(ScreenUtils.renderEmpty());
				} else {
					view.display.innerHTML = display;
				}
			}

			if (tip) {
				tipContent = tip;
				tooltipContent.innerText = tipContent;
			}

			clipContent = (clip === undefined)
				? String(display)
				: clip;
		}

		(wholeView ? view : view.copy).addEventListener("click", (e) => {
			if (!clipContent)
				return;

			e.preventDefault();
			e.stopPropagation();

			navigator.clipboard.writeText(clipContent);
			view.copy.dataset.icon = "circleCheck";
			view.copy.dataset.color = "blue";
			view.copy.classList.add("style-solid");
			tooltipContent.innerText = app.string("clipboard_copied");

			clearTimeout(resetCopyButton);
			resetCopyButton = setTimeout(() => {
				view.copy.dataset.icon = "copy";
				view.copy.dataset.color = null;
				view.copy.classList.remove("style-solid");
				tooltipContent.innerText = tipContent;
			}, 3000);
		});

		set({ display, tip, clip });
		view.set = set;
		return view;
	}

	static renderTag(tag, color = "accent") {
		const view = document.createElement("span");
		view.classList.add("map-color", "screen-tag");
		view.dataset.color = color;
		view.innerText = tag;
		return view;
	}
}

class ScreenGroup {
	/**
	 * Create a new group.
	 *
	 * @param	{string}		id
	 * @param	{string}		name
	 * @param	{object}		options
	 * @param	{?ScreenGroup}  options.parent
	 * @param	{?ScreenGroup}	options.after		Display this group after specified group in the menu.
	 * @param	{boolean}		options.collapsed	Should this group be collapsed by default?
	 */
	constructor(id, name, { parent = null, after = null, collapsed = false } = {}) {
		/** @type {TreeDOM} */
		this.container = makeTree("div", "group", {
			groupName: { tag: "div", class: "name" }
		});

		this.id = `menu-group-${id}`;
		this.name = name;

		if (parent) {
			this.id = parent.id + `-${id}`;

			if (after && parent.container.contains(after.container)) {
				insertAfter(this.container, after.container);
			} else {
				parent.container.appendChild(this.container);
			}
		} else {
			// Insert directly into menu.
			if (after && app.screen.container.menu.contains(after.container)) {
				insertAfter(this.container, after.container);
			} else {
				app.screen.container.menu.appendChild(this.container);
			}
		}

		this.container.id = this.id;
		this.collapsed = false;

		if (collapsed)
			this.collapse();

		this.container.groupName.addEventListener("click", () => {
			this.collapsed ? this.expand() : this.collapse();
		});
	}

	set name(name) {
		this.container.groupName.innerText = name;
	}

	get name() {
		return this.container.groupName.innerText;
	}

	expand() {
		this.container.classList.remove("collapse");
		this.collapsed = false;
		return this;
	}

	collapse() {
		this.container.classList.add("collapse");
		this.collapsed = true;
		return this;
	}
}

class ScreenChild {
	/**
	 * Create a new child in a group.
	 *
	 * @param   {ScreenGroup}       group
	 * @param   {string}            id
	 * @param   {string}            name
	 * @param   {object}            options
	 * @param   {string}            options.title
	 * @param   {string}            options.screen
	 * @param   {boolean}           options.activated
	 * @param   {boolean}           options.scrollable		Apply scrollable to this panel.
	 * @param   {boolean}           options.noGrid			Disable grid system.
	 * @param   {boolean}           options.canvas			Enable canvas mode. Grid system will be replaced with full height block.
	 */
	constructor(group, id, name, {
		title,
		screen,
		activated = false,
		scrollable = true,
		noGrid = false,
		canvas = false
	} = {}) {
		if (typeof app.screen.instances[id] !== "undefined")
			throw new Error(`ScreenChild(): A screen with ID ${id} has already been registered.`);

		this.id = id;
		this.sideShowing = false;
		this.panelShowing = false;
		this.activated = false;
		this.name = name;
		this.group = group;
		this.currentSideLocation = null;

		/** @type {{[key: string]: string|number}} */
		this.state = {};

		/** @type {"desktop" | "tablet" | "mobile"} */
		this.screenMode = "desktop";

		this.menu = document.createElement("div");
		this.menu.classList.add("child");
		this.menu.innerText = name;
		this.menu.id = `menu-child-${id}`;

		this.container = makeTree("div", ["screen", "side-hidden"], {
			main: { tag: "div", class: "main", child: {
				alerts: { tag: "div", class: "alerts" },

				breadcrumbs: { tag: "div", class: "breadcrumbs" },

				header: { tag: "div", class: "header", child: {
					info: { tag: "span", class: "info", child: {
						childName: { tag: "span", class: "name", text: title ? title : name },
						count: { tag: "span", class: "count" }
					}},

					actions: { tag: "span", class: "actions" }
				}},

				content: { tag: "div", class: "content" }
			}},

			side: { tag: "div", class: "side", child: {
				pill: { tag: "div", class: "pill" },

				header: { tag: "div", class: "header", child: {
					info: { tag: "span", class: "info", child: {
						sTitle: { tag: "div", class: "title", text: "Side Panel" }
					}},

					actions: { tag: "span", class: "actions" },
				}},

				content: { tag: "div", class: "content" }
			}},

			panelBackground: { tag: "div", class: "panel-background" },

			panel: { tag: "div", class: "panel", child: {
				header: { tag: "div", class: "header", child: {
					info: { tag: "span", class: "info", child: {
						sTitle: { tag: "div", class: "title", text: "Panel" }
					}},

					actions: { tag: "span", class: "actions" },
				}},

				content: { tag: "div", class: "content" }
			}}
		});

		this.container.id = `screen-${id}`;
		group.container.appendChild(this.menu);

		/** @type {ScreenBreadcrumb[]} */
		this.breadcrumbs = Array();

		this.activateListeners = [];
		this.deactivateListeners = [];
		this.sideToggleListeners = [];
		this.panelToggleListeners = [];
		this.stateChangeListeners = [];
		this.screenModeChangeListeners = [];

		this.loadingOverlay = new LoadingOverlay(this.container);
		this.count = -1;

		this.closeSideButton = createButton("", { icon: "close", color: "brown" });
		this.closeSideButton.addEventListener("click", () => this.hideSide());

		this.toggleSideButton = createButton(htmlToElement(`<span class="toggle-side-icon"></span>`), { color: "blue" });
		this.toggleSideButton.addEventListener("click", () => {
			this.sideLocation = (this.currentSideLocation === "bottom")
				? "right"
				: "bottom";
		});

		this.closePanelButton = createButton("", { icon: "close", color: "brown" });
		this.closePanelButton.addEventListener("click", () => this.hidePanel());
		this.container.panelBackground.addEventListener("click", () => this.hidePanel());

		// Default side panel to right.
		this.sideLocation = "right";

		this.dragging = false;
		this.dragStart = { x: null, y: null };
		this.containerRect = null;
		this.containerWidth = 0;

		const sidePanelMoveHandler = ({ clientX, clientY }) => {
			if (!this.dragging)
				return;

			if (this.sideLocation === "right") {
				const value = scaleValue(
					clientX,
					[this.containerRect.x, this.containerRect.x + this.containerRect.width],
					[100, 0]
				);

				this.sideSize = Math.max(value, 20);
			} else {
				const value = scaleValue(
					clientY,
					[this.containerRect.y, this.containerRect.y + this.containerRect.height],
					[100, 0]
				);

				this.sideSize = Math.max(value, 20);
			}
		};

		this.container.side.pill.addEventListener("mousedown", ({ clientX, clientY }) => {
			if (this.dragging)
				return;

			this.dragging = true;
			this.dragStart.x = clientX;
			this.dragStart.y = clientY;
			this.containerRect = this.container.getBoundingClientRect();
			this.container.classList.add("dragging");
			document.body.addEventListener("mousemove", sidePanelMoveHandler);
		});

		document.body.addEventListener("mouseup", () => {
			if (!this.dragging)
				return;

			this.dragStart = { x: null, y: null };
			this.containerRect = null;
			this.dragging = false;
			this.container.classList.remove("dragging");
			document.body.removeEventListener("mousemove", sidePanelMoveHandler);
		});

		const dashboardBread = new ScreenBreadcrumb(app.string("dashboard"));
		const groupBread = new ScreenBreadcrumb(group.name);
		const screenBread = new ScreenBreadcrumb(name);
		this.addBreadcrumb(dashboardBread).addBreadcrumb(groupBread).addBreadcrumb(screenBread);

		if (screen) {
			if (typeof screen === "object" && screen.tagName)
				this.content.appendChild(screen);
			else
				this.content.innerHTML = screen;
		}

		if (canvas) {
			noGrid = true;
			this.container.classList.add("canvas");
		}

		if (noGrid)
			this.container.classList.add("no-grid");

		if (scrollable) {
			this.scroll = new Scrollable(this.container, {
				content: this.container.main,
				scrollout: false
			});
		}

		new Scrollable(this.sidePanel, {
			content: this.side,
			scrollout: false
		});

		new Scrollable(this.panelNode, {
			content: this.panel,
			scrollout: false
		});

		// Save latest sticky point.
		this.stickyPoint = 0;
		this.container.main.addEventListener("scroll", () => this.updateScroll());
		this.onActivate(() => this.updateScroll(true));

		(new ResizeObserver(() => this.updateScreenMode()))
			.observe(this.container.main.content);

		(new ResizeObserver(() => this.updateScreenSize()))
			.observe(this.container);

		if (activated)
			this.activate();

		this.menu.addEventListener("click", () => this.activate());
		app.screen.instances[this.id] = this;
	}

	/**
	 * Set screen child loading state.
	 *
	 * @param	{boolean}	loading
	 */
	set loading(loading) {
		this.loadingOverlay.loading = loading;
	}

	/**
	 * Return screen child loading state.
	 *
	 * @return	{boolean}
	 */
	get loading() {
		return this.loadingOverlay.loading;
	}

	updateScroll(updateStickyPoint = false) {
		if (!this.stickyPoint || updateStickyPoint) {
			const remSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
			const alerts = this.container.main.alerts.childNodes;
			const alertHeight = [...alerts].reduce((value, node) => value + node.clientHeight, 0);
			const heights = alertHeight + this.container.main.breadcrumbs.clientHeight + (remSize * 3);
			this.stickyPoint = heights;
		}

		if (this.container.main.scrollTop >= this.stickyPoint) {
			this.container.main.classList.add("sticky-header");
		} else {
			this.container.main.classList.remove("sticky-header");
		}
	}

	updateScreenSize() {
		const width = this.container.clientWidth;

		// Width is 0px when the container is out of the dom tree, we should not
		// update the size in this case.
		if (!width)
			return;

		this.containerWidth = width;
		clog("DEBG", `ScreenChild(${this.id}): container at ${this.containerWidth}px width`);
		this.sideLocation = (this.containerWidth <= 1200) ? "bottom" : "right";
	}

	updateScreenMode() {
		if (!this.activated)
			return;

        let mode = "desktop";

        if (this.container.main.content.clientWidth <= 640)
            mode = "mobile";
        else if (this.container.main.content.clientWidth <= 1020)
            mode = "tablet";

        if (mode !== this.screenMode) {
            clog("INFO", `ScreenChild(${this.id}): screen mode changed to`, mode);

            for (let listener of this.screenModeChangeListeners) {
                try {
                    listener(mode);
                } catch (e) {
                    clog("WARN", `ScreenChild(${this.id}).updateScreenMode(): listener handled with error`, e);
                }
            }
        }

        this.screenMode = mode;
		this.container.main.dataset.screen = this.screenMode;
    }

	/**
     * Register for screen mode change event.
     *
     * @param   {(size: "desktop"|"tablet"|"mobile") => void}   f
     * @returns {number}
     */
    onScreenModeChange(f) {
        f(this.screenMode);
        return this.screenModeChangeListeners.push(f);
    }

	get content() {
		return this.container.main.content;
	}

	set content(content) {
		if (typeof content === "string") {
			this.content.innerHTML = content;
		} else if (typeof content === "object") {
			emptyNode(this.content);

			if (isElement(content))
				this.content.appendChild(content);
			else if (isElement(content.container))
				this.content.appendChild(content.container);
			else if (isElement(content.group))
				this.content.appendChild(content.group);
			else
				this.content.innerHTML = content;
		}
	}

	get sidePanel() {
		return this.container.side;
	}

	get side() {
		return this.container.side.content;
	}

	/**
	 * Set side panel size
	 *
	 * @param	{number}	size
	 */
	set sideSize(size) {
		this.container.style.setProperty("--side-size", `${size}%`);
	}

	/**
	 * Set side panel location
	 *
	 * @param	{"bottom" | "right"}	location
	 */
	set sideLocation(location) {
		if (this.currentSideLocation === location)
			return;

		this.container.classList[location === "right" ? "add" : "remove"]("side-right");
		this.currentSideLocation = location;
		this.toggleSideButton.dataset.location = location;
		clog("DEBG", `ScreenChild(${this.id}): side location updated to ${this.currentSideLocation}`);
	}

	/**
	 * Set side panel location
	 *
	 * @return	{"bottom" | "right"}
	 */
	get sideLocation() {
		return this.currentSideLocation;
	}

	/**
	 * Listen for side panel open/close event.
	 *
	 * @param	{(showing: boolean) => void}	f
	 */
	onSideToggle(f) {
		this.sideToggleListeners.push(f);
		return this;
	}

	async hideSide() {
		if (!this.sideShowing)
			return this;

		this.container.classList.remove("side-show");
		await delayAsync(300);
		this.container.classList.add("side-hidden");
		emptyNode(this.side);
		this.sideShowing = false;
		this.sideToggleListeners.forEach((f) => f(false));
		return this;
	}

	/**
	 * Show side panel.
	 *
	 * @param   {object}        options
	 * @param   {string}        options.title
	 * @param   {SQButton[]}    options.actions
	 * @param   {HTMLElement}   options.content
	 */
	async showSide({
		title,
		actions = [],
		content = undefined
	} = {}) {
		if (title)
			this.sidePanel.header.info.sTitle.innerText = title;

		if (actions) {
			emptyNode(this.sidePanel.header.actions);
			this.sidePanel.header.actions.append(...actions);
			this.sidePanel.header.actions.appendChild(this.toggleSideButton);
			this.sidePanel.header.actions.appendChild(this.closeSideButton);
		}

		if (isElement(content)) {
			this.content.classList.add("side-content");
			emptyNode(this.side);
			this.side.appendChild(content);
		}

		if (!this.sideShowing) {
			this.container.classList.remove("side-hidden");
			await nextFrameAsync();
			this.container.classList.add("side-show");
			this.sideShowing = true;
		}

		this.sideToggleListeners.forEach((f) => f(true));
		return this;
	}

	get panelNode() {
		return this.container.panel;
	}

	get panel() {
		return this.container.panel.content;
	}

	/**
	 * Listen for panel open/close event.
	 *
	 * @param   {(showing: boolean) => void}    f
	 */
	onPanelToggle(f) {
		this.panelToggleListeners.push(f);
		return this;
	}

	/**
	 * Show second level panel. This will appear on top of side panel.
	 *
	 * @param   {object}        options
	 * @param   {string}        options.title
	 * @param   {SQButton[]}    options.actions
	 * @param   {HTMLElement}   options.content
	 */
	async showPanel({
		title,
		actions = [],
		content = undefined
	} = {}) {
		if (title)
			this.panelNode.header.info.sTitle.innerText = title;

		if (actions) {
			emptyNode(this.panelNode.header.actions);
			this.panelNode.header.actions.append(...actions);
			this.panelNode.header.actions.appendChild(this.closePanelButton);
		}

		if (isElement(content)) {
			this.content.classList.add("panel-content");
			emptyNode(this.panel);
			this.panel.appendChild(content);
		}

		if (!this.panelShowing) {
			this.container.classList.add("panel-display");
			await nextFrameAsync();
			this.container.classList.add("panel-show");
			this.panelShowing = true;
		}

		this.panelToggleListeners.forEach((f) => f(true));
		return this;
	}

	async hidePanel() {
		if (!this.panelShowing)
			return this;

		this.container.classList.remove("panel-show");
		await delayAsync(300);
		this.container.classList.remove("panel-display");
		emptyNode(this.panel);
		this.panelShowing = false;
		this.panelToggleListeners.forEach((f) => f(false));
		return this;
	}

	/**
	 * Set title
	 *
	 * @param   {string}    title
	 */
	set title(title) {
		this.container.main.header.info.childName.innerText = title;
	}

	/**
	 * Set title count number
	 *
	 * @param   {number}    count
	 */
	set count(count) {
		if (count < 0) {
			this.container.main.header.info.count.style.display = "none";
			return;
		}

		this.container.main.header.info.count.style.display = null;
		this.container.main.header.info.count.innerText = `(${count})`;
	}

	/**
	 * Listen for when this screen is activated.
	 *
	 * @param	{() => void}	f
	 */
	onActivate(f) {
		this.activateListeners.push(f);

		if (this.activated)
			f();

		return this;
	}

	/**
	 * Listen for when this screen is deactivated.
	 *
	 * @param   {() => void}    f
	 */
	onDeactivate(f) {
		this.deactivateListeners.push(f);

		if (!this.activated)
			f();

		return this;
	}

	/**
	 * @typedef {{
	 * 	alert: TreeDOM
	 * 	progress: ?SQCircularProgress
	 * 	set: (options: { level: ScreenStatuses | "LOADING", message: string|HTMLElement }) => void
	 * 	close: () => void
	 * }} ScreenAlertInstance
	 */

	/**
	 * Create a new alert.
	 *
	 * @param   {ScreenStatuses | "LOADING"}		level
	 * @param   {string|HTMLElement}				message
	 * @returns	{ScreenAlertInstance}
	 */
	alert(level, message) {
		const icons = {
			"OKAY": "circleCheck",
			"INFO": "circleInfo",
			"WARN": "triangleExclamation",
			"ERROR": "circleXMark"
		};

		const alert = makeTree("div", "alert", {
			icon: { tag: "icon" },
			message: { tag: "span", class: "message" },
			close: { tag: "icon", class: "close", icon: "close" }
		});

		const close = () => {
			this.container.main.alerts.removeChild(alert);
			this.updateScroll(true);
		};

		alert.close.addEventListener("click", () => close());
		this.container.main.alerts.appendChild(alert);

		/** @type {SQCircularProgress} */
		let progress;

		const set = ({
			level,
			message
		} = {}) => {
			if (level) {
				level = level.toUpperCase();

				if (level === "LOADING") {
					if (!progress) {
						progress = createCircularProgressBar({
							radius: 8,
							strokeWidth: 2,
							color: "white"
						});

						progress.set({ indeterminate: true });
					}

					if (!alert.contains(progress.group))
						alert.replaceChild(progress.group, alert.icon);
				} else {
					if (!alert.contains(alert.icon))
						alert.replaceChild(alert.icon, progress.group);

					alert.icon.dataset.icon = icons[level];
				}

				alert.setAttribute("level", level);
			}

			if (message) {
				if (isElement(message))
					alert.message.appendChild(message);
				else
					alert.message.innerHTML = message;
			}

			this.updateScroll(true);
		};

		set({ level, message });

		return {
			alert,
			set,
			close,

			get progress() {
				return progress;
			}
		}
	}

	/**
	 * Handle error and render into an alert.
	 *
	 * @param	{Error|object}		error
	 * @param	{ScreenStatuses}	level
	 * @return	{this}
	 */
	handleError(error, level = "ERROR") {
		clog("ERRR", `Error occured in screen ${this.id}:`, error);

		const { code, description } = parseException(error);
		const container = document.createElement("div");
		container.innerHTML = `${description} (Code: ${code})`;

		if (error.data && error.data.report) {
			container.appendChild(document.createElement("br"));
			container.appendChild(createButton(app.string("response.errorReport"), {
				element: "div",
				color: "darkRed",
				icon: "externalLink",
				classes: "mt-05",
				onClick: () => window.open(error.data.report, "_blank")
			}));
		}

		this.alert(level, container);
	}

	/**
	 * Add new breadcrumb.
	 *
	 * @param   {ScreenBreadcrumb}  breadcrumb
	 * @returns {ScreenChild}
	 */
	addBreadcrumb(breadcrumb) {
		if (this.breadcrumbs.includes(breadcrumb))
			return this;

		this.container.main.breadcrumbs.appendChild(breadcrumb.container);
		this.breadcrumbs.push(breadcrumb);
		return this;
	}

	/**
	 * Add new breadcrumb.
	 *
	 * @param   {ScreenBreadcrumb}  breadcrumb
	 * @returns {ScreenChild}
	 */
	removeBreadcrumb(breadcrumb) {
		if (!this.breadcrumbs.includes(breadcrumb))
			return this;

		this.container.main.breadcrumbs.removeChild(breadcrumb.container);
		let index = this.breadcrumbs.indexOf(breadcrumb);
		this.breadcrumbs.splice(index, 1);

		return this;
	}

	/**
	 * Add actionable element to screen header.
	 *
	 * @param	{HTMLElement}	element
	 * @returns {this}
	 */
	addAction(element) {
		this.container.main.header.actions.insertBefore(
			element,
			this.container.main.header.actions.firstChild
		);

		return this;
	}

	/**
	 * Update the current URL hash to reflect specified state of this
	 * screen and handle listeners.
	 *
	 * @param	{object}	state
	 * @param	{boolean}	update		Should we handle all registered listeners.
	 * @returns	{this}
	 */
	setState(state = {}, update = false) {
		const data = [];

		for (const [key, value] of Object.entries(state))
			data.push(`${key}:${value}`);

		const hash = (data.length > 0)
			? `#${this.id}-${data.join("-")}`
			: `#${this.id}`;

		this.state = state;
		history.replaceState({ screenID: this.id, ...state }, null, hash);
		clog("DEBG", `ScreenChild(${this.id}): state change [update = ${update}]`, state);

		if (update)
			this.stateChangeListeners.forEach((f) => f(state));

		return this;
	}

	/**
	 * Listen for when this screen state is changed.
	 *
	 * @param	{(state: {[key: string]: string|number}) => void}	f
	 */
	onStateChange(f) {
		this.stateChangeListeners.push(f);
		return this;
	}

	/**
	 * Activate this screen child with specified state data.
	 *
	 * @param	{object}	state
	 * @returns	{this}
	 */
	activate(state = {}) {
		if (this.activated) {
			this.setState(state, true);
			return this;
		}

		if (app.screen.active) {
			app.screen.active.deactivate();
			app.screen.active = null;
		}

		this.menu.classList.add("active");
		app.screen.container.content.appendChild(this.container);
		app.screen.active = this;

		this.activated = true;
		this.setState(state, true);

		this.updateScreenMode();
		this.activateListeners.forEach((f) => f());
		return this;
	}

	deactivate() {
		if (!this.activated)
			return this;

		this.menu.classList.remove("active");
		app.screen.container.content.removeChild(this.container);

		this.activated = false;
		this.deactivateListeners.forEach((f) => f());
		return this;
	}
}

class ScreenBreadcrumb {
	constructor(name) {
		this.name = name;

		this.container = makeTree("div", "breadcrumb", {
			arrow: { tag: "icon", icon: "arrowRight" },
			link: { tag: "span", class: "link", text: this.name }
		});
	}

	/**
	 * Listen for onclick on this breadcrumb.
	 *
	 * @param   {() => void}  f
	 */
	onClick(f) {
		this.container.setAttribute("clickable", "");
		this.container.link.addEventListener("click", () => f());
	}
}

class ScreenPanel {
	/**
	 * @typedef {"full"|"half"|"third"|"two-third"|"fouth"} ScreenSize
	 */

	/**
	 * Create a new screen panel
	 *
	 * @param {ScreenChild}					screenChild
	 * @param {object}						options
	 * @param {ScreenSize|ScreenSize[]}		options.size
	 *      Size for this screen. Passing array will change
	 *      the size based on current screen mode ([desktop, tablet, mobile]).
	 * @param {number}						options.gap		Space between panel elements.
	 * @param {boolean}						options.canvas	Enable canvas mode. Let the developer have full control of panel area.
	 */
	constructor(screenChild, {
		title,
		size = "full",
		gap = false,
		canvas = false
	} = {}) {
		this.size = size;
		this.searchHandler = () => {};
		this.searchTimeout = null;

		this.container = makeTree("div", "screen-panel", {
			header: { tag: "div", class: "header", child: {
				top: { tag: "div", class: "top", child: {
					info: { tag: "span", class: "info", child: {
						blockTitle: { tag: "span", class: "title", text: title },
						count: { tag: "span", class: "count", text: "(0)" }
					}},

					actions: { tag: "span", class: "actions" }
				}}
			}},

			main: { tag: "div", class: "main", child: {
				content: { tag: "div", class: "content" }
			}}
		});

		if (canvas) {
			this.content.classList.add("canvas");
		} else {
			if (gap) {
				this.content.classList.add("padded");
				this.content.style.gap = gap;
			}
		}

		this.overlay = makeTree("div", "overlay", {
			icon: { tag: "icon" },
			message: { tag: "div", class: "message" },
			actions: { tag: "div", class: "actions" }
		});

		this.bottom = makeTree("div", "bottom", {
			search: { tag: "span", class: "search", child: {
				icon: { tag: "icon", icon: "search" },
				input: { tag: "input", type: "text", placeholder: app.string("type_to_search") }
			}},

			paging: { tag: "div", class: "paging" }
		});

		this.loadingOverlay = new LoadingOverlay(this.container.main);

		this.bottom.search.input.addEventListener("input", () => {
			clearTimeout(this.searchTimeout);

			this.searchTimeout = setTimeout(() => {
				this.searchHandler(this.search);
			}, 500);
		});

		if (typeof this.size === "string") {
			this.container.dataset.size = size;
		} else {
			screenChild.onScreenModeChange((size) => {
				const index = { "desktop": 0, "tablet": 1, "mobile": 2 }[size];
				this.container.dataset.size = this.size[index];
			});
		}

		this.overlayShowing = false;
		this.count = -1;
		this.parent = screenChild;

		screenChild.content.appendChild(this.container);
	}

	set search(search) {
		this.bottom.search.input.value = search;
		this.searchHandler(search);
	}

	get search() {
		return this.bottom.search.input.value;
	}

	get paging() {
		return this.bottom.paging;
	}

	get content() {
		return this.container.main.content;
	}

	/**
	 * Set panel loading state.
	 * Will show an overlay with a spinner when loading is set to true.
	 *
	 * @param	{boolean}	loading
	 */
	set loading(loading) {
		this.loadingOverlay.loading = loading;
	}

	set content(content) {
		if (typeof content === "string") {
			this.container.main.content.innerHTML = content;
		} else if (typeof content === "object") {
			emptyNode(this.container.main.content);

			if (isElement(content))
				this.container.main.content.appendChild(content);
			else if (isElement(content.container))
				this.container.main.content.appendChild(content.container);
			else if (isElement(content.group))
				this.container.main.content.appendChild(content.group);
			else
				this.container.main.content.innerHTML = content;
		}
	}

	/**
	 * Set title
	 * @param   {string}    title
	 */
	set title(title) {
		this.container.header.top.info.blockTitle.innerText = title;
	}

	/**
	 * Set title count number
	 * @param   {number}    count
	 */
	set count(count) {
		if (count < 0) {
			this.container.header.top.info.count.style.display = "none";
			return;
		}

		this.container.header.top.info.count.style.display = null;
		this.container.header.top.info.count.innerText = `(${count})`;
	}

	/**
	 * Listen for on search box input event.
	 *
	 * @param   {(search: string) => void}      f
	 * @returns	{this}
	 */
	onSearch(f) {
		this.container.header.appendChild(this.bottom);
		this.searchHandler = f;
		return this;
	}

	/**
	 * Add a new actionable element (button, etc...) to the header of panel.
	 *
	 * @param	{HTMLButtonElement|SQButton|HTMLElement||SQButton[]|HTMLButtonElement[]|HTMLElement[]}		element
	 * @returns	{this}
	 */
	addAction(element) {
		if (Array.isArray(element)) {
			const group = document.createElement("span");
			group.classList.add("sq-btn-group");

			for (const [index, item] of element.entries()) {
				group.appendChild(item);

				if (index < element.length - 1) {
					const separator = document.createElement("span");
					separator.classList.add("separator");
					group.appendChild(separator);
				}
			}

			this.addAction(group);
			return this;
		}

		if (!isElement(element))
			return this;

		this.container.header.top.actions.insertBefore(element, this.container.header.top.actions.firstChild);
		return this;
	}

	/**
	 * Show overlay message with set icon and message.
	 *
	 * @param	{object}				options
	 * @param	{string}				options.icon
	 * @param	{string|HTMLElement}	options.message
	 * @param	{HTMLElement[]}			options.actions
	 * @returns	{this}
	 */
	showMessage({
		icon,
		message,
		actions
	} = {}) {
		if (typeof icon === "string")
			this.overlay.icon.dataset.icon = icon;

		if (message) {
			if (isElement(message)) {
				emptyNode(this.overlay.message);
				this.overlay.message.appendChild(message);
			} else if (typeof message === "string")
				this.overlay.message.innerHTML = message;
		}

		if (typeof actions === "object" && actions.length) {
			this.overlay.appendChild(this.overlay.actions);

			emptyNode(this.overlay.actions);
			this.overlay.actions.append(...actions);
		} else {
			if (this.overlay.contains(this.overlay.actions))
				this.overlay.removeChild(this.overlay.actions);
		}

		if (!this.overlayShowing) {
			this.container.main.appendChild(this.overlay);
			this.container.classList.add("has-overlay");
			this.overlayShowing = true;
		}

		return this;
	}

	hideMessage() {
		if (this.overlayShowing) {
			this.container.main.removeChild(this.overlay);
			this.container.classList.remove("has-overlay");
			this.overlayShowing = false;
		}

		return this;
	}

	/**
	 * Handle thrown error or request error, and display ii
	 * in the overlay.
	 *
	 * @param	{Error|object}	error
	 */
	handleError(error) {
		let { code, description } = parseException(error);
		let actions = [];

		if (error.data && error.data.report) {
			actions.push(createButton(app.string("response.errorReport"), {
				color: "red",
				icon: "externalLink",
				onClick: () => window.open(error.data.report, "_blank")
			}));
		}

		this.showMessage({
			icon: "exclamation",
			message: `<b>${code}</b> ${description}`,
			actions
		});

		return this;
	}

	/**
	 * Append a new element/node into this panel's content element.
	 *
	 * @param	{Node}	node
	 * @return	{this}
	 */
	append(...node) {
		this.content.append(...node);
		return this;
	}

	/**
	 * Append a new element(s)/node(s) into this panel's content element.
	 *
	 * @param	{Node}	node
	 * @return	{this}
	 */
	appendChild(node) {
		this.content.appendChild(node);
		return this;
	}
}

/**
 * Render a data table represent a model or data used in a screen.
 *
 * @template	{Model}		T
 */
class ScreenTable {
	/**
	 * @typedef {{
	 *  display: string
	 *  size: number
	 *  sortable: boolean
	 *	alwaysUpdate: boolean
	 *  sort: ?HTMLElement
	 *  cell: ?HTMLElement
	 * }} ScreenTableHeaderItem
	 */

	/**
	 * @typedef {{
	 *  title: string
	 *  content: string
	 *  buttons: SQButton[]
	 * }} ScreenTableMessage
	 */

	/**
	 * @typedef {{
	 *  id: number
	 *  row: HTMLTableRowElement
	 *  cells: {[name: string]: HTMLTableCellElement}
	 *  item: T
	 *  values: {[name: string]: T[name]}
	 *  check: DashboardCheckbox
	 *  activate: (single: bool = true, updateAllState: bool = true) => void
	 *  deactivate: (remove: bool = true) => void
	 *  activated: boolean
	 * }} ScreenTableRowItem<T>
	 *
	 * @template	{Model}		T
	 */

	/**
	 * Create a new Screen Table
	 *
	 * @param   {?HTMLElement}								container
	 * @param   {object}									options
	 * @param   {{[name: string]: ScreenTableHeaderItem}}	options.header
	 * @param   {string}									options.sort
	 * @param   {{ [header: string]: any }}					options.data
	 * @param   {boolean}									options.scrollable		Make table content scrollable.
	 * @param   {boolean}									options.capHeight		Limit table height by default.
	 * @param   {boolean}									options.builtInSort		Use built in sort instead of relying on server sorting.
	 * @param   {ScreenTableMessage}						options.empty
	 */
	constructor(container, {
		header = { sample: { display: "Sample Column" } },
		sort,
		data = [],
		scrollable = true,
		capHeight = true,
		builtInSort = true,
		empty = {
			title: "This table is empty",
			content: "There are currently no data available to show. Try reloading to fetch the latest data.",
			buttons: []
		}
	} = {}) {
		this.loadingOverlay = new LoadingOverlay();

		this.container = makeTree("div", "screen-table", {
			overlay: this.loadingOverlay,

			wrapper: { tag: "div", class: "wrapper", child: {
				table: { tag: "table", child: {
					head: { tag: "thead", child: {
						row: { tag: "tr" }
					}},

					body: { tag: "tbody" }
				}}
			}}
		});

		if (capHeight)
			this.container.classList.add("cap-height");

		/** @type {{[name: string]: ScreenTableHeaderItem}} */
		this.headers = {};
		this.sorts = { key: null, asc: true }
		this.columnCount = 0;
		this.rowCount = 0;
		this.builtInSort = builtInSort;
		this.currentData = null;
		this.sortListener = () => {};
		this.alwaysUpdate = { display: true };
		this.lastActivatedClick = 0;

		/** @type {ScreenTableMessage} */
		this.emptyMessage = {};

		this.checkAll = createDashboardCheckbox();
		this.checkAllHeader = makeTree("th", ["header", "check"], {
			cell: { tag: "div", class: "cell", child: {
				check: this.checkAll
			}}
		});

		this.checkAll.input.addEventListener("change", () => {
			this.checkAll.value
				? this.selectAll()
				: this.deselectAll();
		});

		/** @type {?string} */
		this.primaryKey = null;

		this.messageRow = makeTree("tr", "message", {
			td: { tag: "td", colSpan: 1, child: {
				cell: { tag: "div", class: "cell", child: {
					cellTitle: { tag: "div", class: "title", text: "Empty Title" },
					content: { tag: "div", class: "content", text: "Content" },
					buttons: { tag: "div", class: "buttons" }
				}}
			}}
		});

		/** @type {{ [x: string | number]: ScreenTableRowItem<T> }} */
		this.rowItems = {};

		/** @type {ScreenTableRowItem<T>[]} */
		this.activeRows = [];

		/** @type {ScreenTableRowItem<T>[]} */
		this.showingRows = [];

		/** @type {?Scrollable} */
		this.scroll = null;

		if (scrollable) {
			this.scroll = new Scrollable(this.container, {
				content: this.container.wrapper,
				velocity: 2,
				distance: 0.3,
				scrollout: true
			});
		}

		this.header = header;

		if (sort)
			this.sort = sort;

		if (empty)
			this.empty = empty;

		// eslint-disable-next-line no-unused-vars
		this.fallbackProcessor = (name, value, row) => {
			if (isElement(value))
				return value;

			if (value === null || value === undefined)
				return ScreenUtils.renderEmpty();

			let content = document.createElement("div");
			content.innerHTML = value;
			return content;
		};

		// eslint-disable-next-line no-unused-vars
		this.processor = (name, value, row) => undefined;

		// eslint-disable-next-line no-unused-vars
		this.rowProcessor = (item, row) => {};

		/** @type {Function[]} */
		this.activeHandlers = [];

		if (isElement(container))
			container.appendChild(this.container);
		else if (container instanceof ScreenChild || container instanceof ScreenPanel)
			container.content = this.container;

		(new ResizeObserver(() => this.updateTableSize())).observe(this.container);
		this.updateTableSize();

		this.data = data;
	}

	updateTableSize() {
		this.container.style.setProperty("--table-width", this.container.clientWidth + "px");
	}

	get table() {
		return this.container.wrapper.table;
	}

	get primary() {
		return this.primaryKey;
	}

	set primary(key) {
		if (!this.headers[key])
			return;

		this.primaryKey = key;
	}

	/**
	 * Set loading state.
	 *
	 * @param   {boolean}   loading
	 */
	set loading(loading) {
		this.loadingOverlay.loading = loading;
	}

	/**
	 * Set item processor.
	 *
	 * @param   {(name: string, value, instance: T) => ?(HTMLElement|string)}  f
	 */
	setProcessor(f) {
		this.processor = f;
		return this;
	}

	/**
	 * Set item processor.
	 *
	 * @param   {(item: ScreenTableRowItem<T>, row: HTMLTableRowElement) => void}  f
	 */
	setRowProcessor(f) {
		this.rowProcessor = f;
		return this;
	}

	/**
	 * Listen for double clicking row event.
	 *
	 * @param   {(item: ScreenTableRowItem<T>, row: HTMLTableRowElement) => void}  f
	 */
	onActive(f) {
		this.activeHandlers.push(f);
		return this;
	}

	updateAllCheck() {
		if (this.activeRows.length > 0) {
			if (this.activeRows.length >= this.showingRows.length)
				this.checkAll.value = true;
			else
				this.checkAll.partial = true;

			return this;
		}

		this.checkAll.value = false;
		return this;
	}

	selectAll() {
		for (let [, row] of Object.entries(this.showingRows))
			row.activate(false, false);

		this.checkAll.value = true;
		return this;
	}

	deselectAll() {
		for (let [, row] of Object.entries(this.showingRows))
			row.deactivate(false);

		this.activeRows = [];
		this.checkAll.value = false;
		return this;
	}

	/**
	 * Set empty cell texts and options.
	 *
	 * @param   {ScreenTableMessage}   empty
	 */
	set empty(empty) {
		this.emptyMessage = empty;
		this.resetMessage();
	}

	setMessage({
		title,
		content,
		buttons
	} = {}) {
		this.messageRow.td.cell.cellTitle.innerHTML = title;
		this.messageRow.td.cell.content.innerHTML = content;
		emptyNode(this.messageRow.td.cell.buttons);

		if (buttons && buttons.length > 0) {
			this.messageRow.td.cell.buttons.append(...buttons);
			this.messageRow.td.cell.buttons.display = "none";
		} else {
			// Hide the buttons element so it does not take
			// any space.
			this.messageRow.td.cell.buttons.display = null;
		}

		return this;
	}

	showMessage() {
		emptyNode(this.table.body);
		this.messageRow.td.colSpan = this.columnCount + 1;
		this.table.body.appendChild(this.messageRow);
		this.table.classList.add("message");
		this.showingRows = [];
		return this;
	}

	resetMessage() {
		this.setMessage(this.emptyMessage);
		return this;
	}

	/**
	 * Handle thrown error or request error, and display it
	 * in the overlay.
	 *
	 * @param	{Error|object}	error
	 * @param	{HTMLElement}	actions		Extra action buttons.
	 */
	handleError(error, actions = []) {
		clog("ERRR", `ScreenTable()`, error);
		let { code, description } = parseException(error);

		if (error.data && error.data.report) {
			actions.push(createButton(app.string("response.errorReport"), {
				color: "red",
				icon: "externalLink",
				onClick: () => window.open(error.data.report, "_blank")
			}));
		}

		this.setMessage({
			title: code,
			content: description,
			buttons: actions
		});

		this.showMessage();
		return this;
	}

	/**
	 * Set table header.
	 *
	 * @param   {{[name: string]: ScreenTableHeaderItem}}    header
	 */
	set header(header) {
		emptyNode(this.table.head.row);
		this.table.head.row.appendChild(this.checkAllHeader);
		this.primaryKey = null;

		for (let [name, item] of Object.entries(header)) {
			if (typeof item !== "object") {
				header[name] = { display: item };
				item = header[name];
			}

			let { display, size, sortable = true, alwaysUpdate = false } = item;

			const col = makeTree("th", "header", {
				cell: { tag: "div", class: "cell", child: {
					colName: { tag: "span", class: "name", text: display }
				}}
			});

			// Default the primary key to be the first column.
			if (!this.primaryKey)
				this.primaryKey = name;

			col.dataset.name = name;
			header[name].cell = col.cell;
			header[name].sort = null;

			if (typeof size === "number")
				col.style.width = `${size}px`;

			if (sortable) {
				const sort = document.createElement("icon");
				sort.dataset.icon = "sortDown";

				col.cell.addEventListener("click", () => {
					// Update current sort.
					this.sort = name
				});

				header[name].sort = sort;
				col.cell.appendChild(sort);
			}

			if (alwaysUpdate)
				this.alwaysUpdate[name] = true;

			this.table.head.row.appendChild(col);
		}

		this.headers = header;

		// If ID is available, use that instead.
		if (this.headers.id)
			this.primary = "id";

		this.columnCount = Object.keys(this.headers).length;
		this.messageRow.td.colSpan = this.columnCount + 1;
	}

	/**
	 * Set sort by column name.
	 * @param   {string}    name
	 */
	set sort(name) {
		this.setSort(name);
	}

	/**
	 * Set sorting direction for current table.
	 *
	 * @param	{string}	key					Sorting column name.
	 * @param	{object}	options
	 * @param	{?boolean}	options.ascending	Sort in ascending direction. Default to toggle on the same key or ascending on different key.
	 * @param	{boolean}	options.update		Trigger data update after sort direction set.
	 * @returns
	 */
	setSort(key, {
		ascending = null,
		update = true
	} = {}) {
		if (key === this.sorts.key && ascending === this.sorts.asc)
			return this;

		if (!this.headers[key]) {
			clog("WARN", `ScreenTable().setSort(): unknown column name: ${key}`);
			return this;
		}

		let cel = this.headers[key].cell;
		let same = false;

		if (ascending === null) {
			if (this.sorts.key && this.sorts.key === key) {
				ascending = !this.sorts.asc;
				same = true;
			} else {
				ascending = true;
			}
		}

		if (!same && this.sorts.key && this.headers[this.sorts.key]) {
			let old = this.headers[this.sorts.key].cell;
			old.removeAttribute("data-sort");
		}

		this.sorts.key = key;
		this.sorts.asc = ascending;
		cel.dataset.sort = ascending ? "asc" : "desc";

		if (update) {
			this.data = this.currentData;
			this.sortListener(key, cel.dataset.sort);
		}

		return this;
	}

	/**
	 * Listen for table sort.
	 *
	 * @param   {(by, direction) => void}   f
	 */
	onSort(f) {
		this.sortListener = f;
		return this;
	}

	/**
	 * Set table data.
	 *
	 * @param	{T[]}	data
	 */
	set data(data) {
		emptyNode(this.table.body);
		const headers = Object.keys(this.headers);
		this.columnCount = headers.length;
		this.rowCount = data.length;
		this.currentData = data;
		this.deselectAll();

		if (!data || data.length === 0) {
			this.showMessage();
			return;
		}

		if (this.sorts.key && this.builtInSort) {
			data = data.sort((a, b) => {
				a = a[this.sorts.key];
				b = b[this.sorts.key];

				if (this.sorts.asc) {
					if (a > b)
						return 1;

					if (a < b)
						return -1;
				} else {
					if (a > b)
						return -1;

					if (a < b)
						return 1;
				}

				return 0;
			});
		}

		this.table.classList.remove("message");
		this.showingRows = [];

		for (let row of data) {
			if (Array.isArray(row)) {
				let oRow = {};

				for (let [i, value] of headers.entries()) {
					if (!row[i])
						break;

					oRow[value] = row[i];
				}

				row = oRow;
			}

			const id = row[this.primary];

			// Use built row.
			if (id && this.rowItems[id]) {
				const item = this.rowItems[id];
				item.item = row;

				for (const name of headers) {
					const value = row[name];

					// Same value as before, skip processing.
					if (value !== undefined && this.alwaysUpdate[name] !== true && item.values[name] == value)
						continue;

					// Not have a valid column, skip this item.
					if (!item.cells[name])
						continue;

					let inner = this.processor(name, value, row);

					if (inner === null || inner === undefined) {
						inner = this.fallbackProcessor(name, value, row);
					} else if (!isElement(inner)) {
						let node = document.createElement("span");
						node.innerHTML = inner;
						inner = node;
					}

					inner.classList.add("cell");
					inner.dataset.key = name;
					inner.dataset.value = value;

					this.rowItems[id].values[name] = value;
					emptyNode(item.cells[name]);
					item.cells[name].appendChild(inner);
				}

				this.table.body.appendChild(item.row);
				this.showingRows.push(item);

				continue;
			}

			const rNode = document.createElement("tr");
			const checkNode = makeTree("td", "check", {
				cell: { tag: "div", class: "cell", child: {
					check: createDashboardCheckbox()
				}}
			});

			rNode.appendChild(checkNode);

			let _this = this;
			rNode.dataset.rowId = id;

			/** @type {ScreenTableRowItem<T>} */
			const item = {
				id,
				row: rNode,
				cells: {},
				item: row,
				values: {},
				check: checkNode.cell.check,
				activated: false,

				activate(single = true, updateAllState = true) {
					if (single) {
						// Deactiavte all active rows.
						for (let row of _this.activeRows) {
							if (row === this)
								continue;

							row.deactivate(false);
						}

						_this.activeRows = this.activated
							? [this]
							: [];
					}

					if (this.activated) {
						// We should do an update check here just to make sure
						// when all other rows are deactivated.
						if (updateAllState)
							_this.updateAllCheck();

						return;
					}

					rNode.classList.add("active");
					this.check.value = true;
					this.activated = true;

					if (!_this.activeRows.includes(this))
						_this.activeRows.push(this);

					if (updateAllState)
						_this.updateAllCheck();
				},

				deactivate(remove = true) {
					if (!this.activated)
						return;

					rNode.classList.remove("active");
					this.check.value = false;
					this.activated = false;

					if (remove) {
						let i = _this.activeRows.indexOf(this);

						if (i >= 0)
							_this.activeRows.splice(i, 1);

						_this.updateAllCheck();
					}
				}
			};

			item.check.input.addEventListener("change", () => {
				item.check.value
					? item.activate(false)
					: item.deactivate();
			});

			rNode.addEventListener("click", (e) => {
				if (item.check.container.contains(e.target))
					return;

				const now = performance.now();
				const timeWindow = now - this.lastActivatedClick;
				this.lastActivatedClick = now;

				if (item.activated) {
					if (e.ctrlKey) {
						// Deactivate this item.
						item.deactivate();
					} else {
						// Only activate this item.
						item.activate();
					}

					// Detecting double click on a single item.
					if (this.activeRows.length === 1 && this.activeRows[0].id === item.id) {
						// Two consecutive click in a time window of 300ms.
						if (timeWindow <= 300) {
							for (let f of this.activeHandlers)
								f(item, rNode);
						}
					}

					return;
				}

				item.activate(!e.ctrlKey);
			});

			rNode.addEventListener("contextmenu", (e) => {
				e.preventDefault();

				if (!item.activated)
					item.activate(true);
			});

			// TODO: This is currently not working properly because it
			// TODO: conflicting with the "click" event, a better implementation
			// TODO: of this is required.
			// const handleDragSelect = (e) => {
			// 	// Only handle when both ctrl key and left mouse is activated.
			// 	if (!e.ctrlKey || (e.buttons & 1) != 1)
			// 		return;

			// 	e.preventDefault();
			// 	e.stopPropagation();

			// 	// Replicate the drag-select behaviour.
			// 	if (!item.activated)
			// 		item.activate(false);
			// }

			// rNode.addEventListener("mousedown", handleDragSelect);
			// rNode.addEventListener("mouseenter", handleDragSelect);

			for (const header of headers) {
				const cell = document.createElement("td");
				rNode.appendChild(cell);

				let inner = this.processor(header, row[header], row);

				if (inner === null || inner === undefined) {
					inner = this.fallbackProcessor(header, row[header], row);
				} else if (!isElement(inner)) {
					let node = document.createElement("span");
					node.innerHTML = inner;
					inner = node;
				}

				inner.classList.add("cell");
				inner.dataset.key = header;
				inner.dataset.value = row[header];

				item.cells[header] = cell;
				item.values[header] = row[header];
				cell.appendChild(inner);
			}

			this.rowItems[id] = item;
			this.table.body.appendChild(rNode);
			this.showingRows.push(item);
			this.rowProcessor(item, rNode);
		}
	}
}

/**
 * A table block.
 *
 * @template	{Model}		T
 */
class ScreenTableBlock {
	/**
	 * Create a new Screen Table
	 *
	 * @param		{object}									[options]
	 * @param		{{[name: string]: ScreenTableHeaderItem}}	options.header
	 * @param		{string}									options.sort
	 * @param		{boolean}									options.builtInSort
	 * @param		{ScreenTableMessage}						options.empty
	 * @param		{ScreenTableMessage}						options.searchEmpty
	 * @param		{() => void}								[options.onUpdate]
	 * @param		{boolean}									[options.capHeight]
	 * @param		{boolean}									[options.scrollable]
	 * @param		{boolean}									[options.border]
	 */
	constructor(options = {}) {
		if (!options.searchEmpty) {
			options.searchEmpty = {
				title: null,
				message: null,
				buttons: []
			};
		}

		if (typeof options.capHeight !== "boolean")
			options.capHeight = true;

		if (typeof options.scrollable !== "boolean")
			options.scrollable = true;

		if (typeof options.border !== "boolean")
			options.border = true;

		this.onUpdate = (typeof options.onUpdate === "function")
			? options.onUpdate
			: null;

		this.reloadButton = createButton("", {
			icon: "reload",
			color: "blue",
			onClick: async () => await this.update()
		});

		this.tryAgainButton = createButton(app.string("button.tryAgain"), {
			onClick: async () => await this.update(),
			color: "pink",
			icon: "reload"
		});

		this.container = makeTree("div", "screen-table-block", {
			header: { tag: "div", class: "header", child: {
				search: { tag: "span", class: "search", child: {
					icon: { tag: "icon", icon: "search" },
					input: { tag: "input", type: "text", placeholder: app.string("type_to_search") }
				}},

				actions: { tag: "div", class: "actions", child: {
					reload: this.reloadButton
				}},

				paging: { tag: "div", class: "paging" }
			}},

			table: { tag: "div", class: "table" }
		});

		if (!options.border)
			this.container.classList.add("no-border");

		this.searchEmpty = options.searchEmpty;
		this.search = "";
		this.searchTimeout = null;
		this.sort = { by: null, direction: "DESC" };
		this.loading = false;

		this.container.header.search.input.addEventListener("input", (e) => {
			clearTimeout(this.searchTimeout);
			this.search = e.target.value;
			this.searchTimeout = setTimeout(() => this.update({ resetPage: true }), 500);
		});

		/** @type {(search: string, page: number) => Promise<ScreenTableBlockFetch>} */
		this.fetchHandler = () => ({ total: 0, page: 1, maxPage: 1, data: [] });

		/** @type {ScreenTable<T>} */
		this.table = new ScreenTable(this.container.table, options);

		this.paging = new PagingBar(this.container.header.paging, { show: 7 });
		this.paging.onChange(() => this.update());

		this.table.onSort(async (by, direction) => {
			this.sort.by = by;
			this.sort.direction = direction;
			await this.update();
		});
	}

	addAction(element) {
		this.container.header.actions.insertBefore(element, this.reloadButton);
		return this;
	}

	/**
	 * @typedef {{
	 *  page: number
	 *  maxPage: number
	 *  total: number
	 *  data: T[]
	 * }} ScreenTableBlockFetch
	 */

	/**
	 * Handle fetch event for this table.
	 *
	 * @param   {(search: string, page: number, sort: ?string, direction: "ASC" | "DESC") => Promise<ScreenTableBlockFetch>}     f
	 */
	onFetch(f) {
		this.fetchHandler = f;
	}

	async update({ resetPage = false } = {}) {
		if (this.loading)
			return;

		this.loading = true;
		this.reloadButton.loading = true;
		this.table.loading = true;

		if (resetPage)
			this.paging.setPage(1, false, true);

		try {
			// eslint-disable-next-line no-unused-vars
			let { page, maxPage, total, data } = await this.fetchHandler(
				this.search,
				this.paging.page,
				this.sort.by,
				this.sort.direction
			);

			if (data.length === 0) {
				if (this.search) {
					// Replace message with empty one.
					this.table.setMessage({
						title: this.searchEmpty.title || app.string("no_result", { query: escapeHTML(this.search) }),
						content: this.searchEmpty.message,
						buttons: this.searchEmpty.buttons
					});
				} else {
					// Reset message to normal empty result.
					this.table.resetMessage();
				}
			}

			this.paging.max = maxPage;
			this.paging.setPage(page, false, true);
			this.table.data = data;
		} catch (e) {
			this.table.handleError(e);
		}

		this.table.loading = false;
		this.reloadButton.loading = false;
		this.loading = false;

		if (typeof this.onUpdate === "function")
			this.onUpdate();
	}
}

class ContextMenu {
	/**
	 * Create a new context menu.
	 *
	 * @param   {?HTMLElement}	target
	 * @param   {object}		options
	 * @param   {boolean}		options.id		Attach event to target.
	 * @param   {boolean}		options.event	Attach event to target.
	 * @param   {boolean}		options.fixed	Show context menu in a fixed position relative to target.
	 */
	constructor(target = null, {
		id = null,
		event = true,
		fixed = false
	} = {}) {
		this.id = (id) ? id : randString(8);

		this.view = document.createElement("div");
		this.view.classList.add("context-menu");
		this.view.id = `context-menu-${this.id}`;

		/** @type {TreeDOM} */
		this.headerNode = null;

		this.transitioning = false;
		this.showing = false;
		this.opening = false;
		this.processing = false;
		this.disableAll = false;

		/** @type {?ContextMenu} */
		this.currentSubMenu = null;

		/** @type {?ContextMenu} */
		this.currentParentMenu = null;

		/**
		 * Store the parent menu item that opened this menu.
		 *
		 * @type {?TreeDOM}
		 */
		this.parentMenuOpener = null;

		this.spinner = document.createElement("div");
		this.spinner.classList.add("simpleSpinner");

		/** @type {{[name: string]: HTMLElement}} */
		this.items = {};

		/** @type {() => Promise|void} */
		this.openHandler = () => {};

		/** @type {() => Promise|void} */
		this.selectHandler = () => {};

		if (isElement(target)) {
			this.target = target;

			if (event) {
				if (fixed) {
					target.addEventListener("click", () => {
						if (this.opening)
							return;

						this.openAtElement(target);
					});
				} else {
					target.addEventListener("contextmenu", (e) => this.openByMouseEvent(e));
				}
			}
		}

		app.root.addEventListener("click", (e) => {
			if (!this.showing)
				return;

			if (e.target === this.view || this.view.contains(e.target))
				return;

			// A submenu of this menu is opening and user clicked on this menu,
			// we probally don't want to close the parent menu.
			if (this.currentSubMenu && (e.target == this.currentSubMenu.view || this.currentSubMenu.view.contains(e.target)))
				return;

			// Clicked on the menu item button that opened this submenu. We don't
			// want this click event to close this child menu.
			if (this.parentMenuOpener && (e.target == this.parentMenuOpener.view || this.parentMenuOpener.view.contains(e.target)))
				return;

			this.close();
		});
	}

	/**
	 * Disable all items in the menu
	 *
	 * @param   {boolean}   disabled
	 */
	set disabled(disabled) {
		this.view.classList[disabled ? "add" : "remove"]("disabled");
		this.disableAll = disabled;
	}

	/**
	 * Update the context menu header.
	 *
	 * @param	{object}				options
	 * @param	{string|HTMLElement}	options.title		Header title
	 * @param	{string|HTMLElement}	options.content		Header content
	 * @returns	{this}
	 */
	header({
		title,
		content
	} = {}) {
		if (!this.headerNode) {
			this.headerNode = makeTree("div", "header", {
				hTitle: { tag: "div", class: "title" },
				content: { tag: "div", class: "content" }
			});

			this.view.appendChild(this.headerNode);
		}

		if (title) {
			if (isElement(title)) {
				emptyNode(this.headerNode.hTitle);
				this.headerNode.hTitle.appendChild(title);
			} else {
				this.headerNode.hTitle.innerText = title;
			}
		}

		if (content) {
			if (isElement(content)) {
				emptyNode(this.headerNode.content);
				this.headerNode.content.appendChild(content);
			} else {
				this.headerNode.content.innerText = content;
			}
		}

		return this;
	}

	/**
	 * Listen for on item select event.
	 *
	 * @param   {(
	 *  id: string
	 *  item: HTMLElement
	 *  options: { preventClose: () => void }
	 * ) => void}    f
	 * @returns	{this}
	 */
	onSelect(f) {
		this.selectHandler = f;
		return this;
	}

	/**
	 * Listen for when the context menu is displayed/opened.
	 *
	 * @param   {(instance: ContextMenu) => void}    f
	 * @returns	{this}
	 */
	onOpen(f) {
		this.openHandler = f;
		return this;
	}

	/**
	 * Handle item select
	 *
	 * @param   {string}            id
	 * @param   {HTMLElement}       item
	 */
	async handleSelect(id, item) {
		if (this.processing || this.disableAll || item.classList.contains("disabled"))
			return;

		let close = true;
		this.processing = true;
		item.classList.add("processing");
		item.appendChild(this.spinner);

		await this.selectHandler(id, item, {
			preventClose() {
				close = false;
			}
		});

		this.processing = false;
		item.classList.remove("processing");
		item.removeChild(this.spinner);

		if (close)
			this.close();
	}

	/**
	 * Add a new menu item into this context menu.
	 *
	 * @param		{object}					options
	 * @param		{string}					options.id			Menu item identifier.
	 * @param		{string}					options.text		The text displayed in the menu item.
	 * @param		{string|HTMLElement}		[options.content]	The content will be displayed in the menu item instead of the text.
	 * @param		{?ContextMenu}				[options.subMenu]	The submenu will display when hovering over this menu item.
	 * @param		{string}					options.icon		Menu item's icon. Can be url.
	 * @param		{string}					options.color		Menu item's color.
	 * @returns
	 */
	add({
		id,
		text = "Item",
		content = undefined,
		subMenu = null,
		icon,
		color = "default"
	} = {}) {
		if (!id)
			throw new Error(`ContextMenu.add(): id is required!`);

		if (this.items[id])
			throw new Error(`ContextMenu.add(): id must be unique for this menu!`);

		const item = makeTree("div", "item", {
			// eslint-disable-next-line no-nested-ternary
			icon: (icon)
				? (icon.startsWith("http") ? { tag: "img", class: "icon", src: icon } : { tag: "icon", icon })
				: null,

			label: { tag: "span", class: "label" },

			arrow: (subMenu)
				? { tag: "icon", class: "arrow", icon: "arrowRight" }
				: null,
		});

		if (content !== undefined) {
			if (isElement(content)) {
				emptyNode(item.label);
				item.label.appendChild(content);
			} else {
				if (content === null || content === "") {
					emptyNode(item.label);
					item.label.appendChild(ScreenUtils.renderEmpty());
				} else {
					item.label.innerHTML = content;
				}
			}
		} else {
			item.label.innerText = text;
		}

		item.dataset.color = color;
		item.id = `context-item-${this.id}.${id}`;
		this.items[id] = item;

		if (subMenu) {
			item.classList.add("has-submenu");
			let showing = false;

			item.addEventListener("mouseenter", () => {
				if (this.transitioning || showing)
					return;

				subMenu.currentParentMenu = this;
				subMenu.parentMenuOpener = item;
				subMenu.openAtElement(item, "right", -8);
				this.currentSubMenu = subMenu;
				showing = true;
			});

			this.view.addEventListener("mouseover", (e) => {
				if (!showing)
					return;

				// Mouse overing current sub-menu item.
				if (e.target === item || item.contains(e.target))
					return;

				// Empty the parent menu reference first to make sure we don't
				// close this menu when we close the submenu on mouse hover out.
				subMenu.currentParentMenu = null;
				subMenu.parentMenuOpener = null;
				subMenu.close();

				this.currentSubMenu = null;
				showing = false;
			});
		} else {
			// Only handle menu item selection when there is
			// no sub-menu to show.
			item.addEventListener("click", () => this.handleSelect(id, item));
		}

		this.view.appendChild(item);

		return this;
	}

	/**
	 * Disable a menu item.
	 *
	 * @param	{string}	id
	 * @param	{boolean}	[disabled]
	 */
	disable(id, disabled = true) {
		this.items[id].classList[disabled ? "add" : "remove"]("disabled");
		return this;
	}

	separator() {
		const sep = document.createElement("div");
		sep.classList.add("separator");
		this.view.appendChild(sep);
		return this;
	}

	/**
	 * Open the context menu in the specified location.
	 *
	 * @param	{object}		options
	 * @param	{number}		options.top		Top position, in pixel.
	 * @param	{number}		options.left	Left position, in pixel.
	 * @returns	{Promise<this>}
	 */
	async open({ top = 0, left = 0 } = {}) {
		if (this.showing && !this.transitioning) {
			// Quickly and temporary hide the menu and show the
			// menu again in a new location.
			this.view.classList.remove("show");
			await delayAsync(150);

			// Something else is handing the transition. We should
			// stop here.
			if (this.transitioning)
				return this;

			this.view.classList.add("show");

			const width = this.view.clientWidth;
			left = Math.min(left, app.root.clientWidth - width - 16);
			this.view.style.left = left + "px";

			const height = this.view.clientHeight;
			top = Math.min(top, app.root.clientHeight - height - 16);
			this.view.style.top = top + "px";

			await this.openHandler(this);
			return this;
		}

		if (this.target)
			this.target.classList.add("context-menu-active");

		// Don't update primary context menu when
		// this menu is being opened as a submenu.
		if (!this.currentParentMenu) {
			if (app.currentContextMenu)
				app.currentContextMenu.close();

			app.currentContextMenu = this;
		}

		this.view.style.top = top + "px";
		this.view.style.left = left + "px";

		// Handle open event before the menu is being displayed.
		await this.openHandler(this);

		this.opening = true;
		this.transitioning = true;
		app.root.appendChild(this.view);
		this.view.classList.add("display");
		await nextFrameAsync();

		// Closing, this mean while we are waiting for the next frame,
		// `close()` was called. We should stop showing the menu.
		if (!this.opening)
			return this;

		// Update left position if panel overshot.
		const width = this.view.clientWidth;
		left = Math.min(left, app.root.clientWidth - width - 16);
		this.view.style.left = left + "px";

		// Update top position if panel overshot.
		const height = this.view.clientHeight;
		top = Math.min(top, app.root.clientHeight - height - 16);
		this.view.style.top = top + "px";

		this.view.classList.add("show");

		this.transitioning = false;
		this.showing = true;
		return this;
	}

	/**
	 * Show the context menu at the specified element.
	 *
	 * @param	{HTMLElement}				target
	 * @param	{"bottom" | "right"}		[position]
	 * @param	{number}					[spacing]
	 * @returns	{Promise<this>}
	 */
	async openAtElement(target, position = "bottom", spacing = 16) {
		this.target = target;
		const rect = target.getBoundingClientRect();
		let top, left;

		switch (position) {
			case "bottom":
				top = rect.y + rect.height + spacing;
				left = rect.x;
				break;

			case "right":
				top = rect.y;
				left = rect.x + rect.width + spacing;
				break;
		}

		await this.open({ top, left });
		return this;
	}

	/**
	 * Handle a mouse event to open this context menu.
	 *
	 * @param	{MouseEvent}	event
	 * @returns	{Promise<this>}
	 */
	async openByMouseEvent(event) {
		event.preventDefault();
		await this.open({ top: event.clientY + 10, left: event.clientX + 10 });
		return this;
	}

	async close() {
		if (!this.showing)
			return this;

		if (this.target)
			this.target.classList.remove("context-menu-active");

		if (this.currentParentMenu)
			this.currentParentMenu.close();

		if (this.currentSubMenu) {
			this.currentSubMenu.currentParentMenu = null;
			this.currentSubMenu.close();

			// Prevent race condition.
			this.currentSubMenu = null;
		}

		this.transitioning = true;
		this.opening = false;
		this.view.classList.remove("show");
		await delayAsync(500);

		// Opening, this mean while we are waiting for animation to
		// complete, `open()` was called. We stop hiding the menu.
		if (this.opening)
			return this;

		this.view.classList.remove("display");

		if (this.showing)
			app.root.removeChild(this.view);

		this.transitioning = false;
		this.showing = false;
		return this;
	}
}

class PagingBar {
	/**
	 * Create a new paging bar.
	 *
	 * @param   {?HTMLElement}   container
	 */
	constructor(container = null, {
		max = 1,
		show = 9
	} = {}) {
		this.container = makeTree("div", "paging-bar", {
			prev: { tag: "icon", icon: "arrowLeft" },
			pages: { tag: "div", class: "pages" },
			next: { tag: "icon", icon: "arrowRight" }
		});

		this.changeHandlers = [];

		/** @type {HTMLElement[]} */
		this.pageNodes = [];

		this.show = show;
		this.maxPages = 1;
		this.current = 1;
		this.max = max;
		this.page = 1;

		this.preDot = document.createElement("span");
		this.preDot.classList.add("dot");
		this.preDot.innerText = "...";

		this.postDot = document.createElement("span");
		this.postDot.classList.add("dot");
		this.postDot.innerText = "...";

		this.container.prev.addEventListener("click", () => this.prev());
		this.container.next.addEventListener("click", () => this.next());

		if (container && isElement(container))
			container.appendChild(this.container);
	}

	/**
	 * Listen for on page change event.
	 *
	 * @param   {(page: number) => void}    f
	 */
	onChange(f) {
		this.changeHandlers.push(f);
		return this;
	}

	clamp(num, min, max) {
		if (num <= min)
			return min;

		if (num >= max)
			return max;

		return num;
	}

	set max(max) {
		this.pageNodes = [];
		emptyNode(this.container.pages);

		for (let p = 1; p <= max; p++) {
			let node = document.createElement("span");
			node.classList.add("page");
			node.innerText = p;
			this.pageNodes[p] = node;

			node.addEventListener("click", () => {
				this.page = p;
			});

			if (max <= this.show)
				this.container.pages.appendChild(node);
		}

		this.maxPages = max;
		this.setPage(Math.min(this.current, max), false, true);
	}

	get max() {
		return this.maxPages;
	}

	set show(show) {
		this.__show = show;
		this.mid = Math.round(show / 2);

		// Force re-render.
		if (this.current)
			this.setPage(this.current, false, true);
	}

	get show() {
		return this.__show;
	}

	setPage(page, event = true, force = false) {
		if (!force && (page < 1 || page > this.max || page === this.page))
			return;

		this.container.prev.classList[page <= 1 ? "add" : "remove"]("disabled");
		this.container.next.classList[page >= this.max ? "add" : "remove"]("disabled");

		if (this.max > this.show) {
			emptyNode(this.container.pages);
			this.container.pages.appendChild(this.pageNodes[1]);

			let dotLeft = false;
			let dotRight = false;

			let lPad = 0;
			let rPad = 0;
			let show = this.show - 2;
			let mDelt = Math.floor(show / 2);

			if (page > this.mid) {
				dotLeft = true;
				show -= 1;
				lPad = 1;
			}

			if (page < this.max - this.mid + 1) {
				dotRight = true;
				show -= 1;
				rPad = 1;
			}

			let from = this.clamp(page - mDelt + lPad, 2, this.max - show);
			let to = Math.min(from + show - rPad, this.max - 1);

			if (dotLeft)
				this.container.pages.appendChild(this.preDot);

			for (let p = from; p <= to; p++)
				this.container.pages.appendChild(this.pageNodes[p]);

			if (dotRight)
				this.container.pages.appendChild(this.postDot);

			this.container.pages.appendChild(this.pageNodes[this.max]);
		}

		if (this.pageNodes[this.current])
			this.pageNodes[this.current].classList.remove("active");

		this.pageNodes[page].classList.add("active");
		this.current = page;

		if (event)
			this.changeHandlers.forEach((f) => f(page));
	}

	set page(page) {
		this.setPage(page);
	}

	get page() {
		return this.current;
	}

	next() {
		this.page += 1;
	}

	prev() {
		this.page -= 1;
	}
}

class ScreenForm {
	/**
	 * @typedef {{
	 *  type: "text" | "checkbox" | "note" | "autocomplete" | "number" | "date" | "datetime" | "node" | "select" | "picker"
	 *  label: string
	 *  options: {}
	 *  node: HTMLElement
	 *  help: ?string
	 *  required: boolean
	 *  default
	 * 	disabled: boolean
	 * 	visible: boolean
	 * 	grow: boolean = true
	 *  dependencies: {
	 *      name: string
	 *      value
	 *  }[]
	 *  onInput(value: any, options: {}, form: ScreenForm) => void
	 *  onSetValue(value: any, options: {}, form: ScreenForm) => void
	 * }} ScreenFormRowItem
	 *
	 * @typedef {{
	 *  [groupID: string]: {
	 *      name: string
	 *      collapse: ?boolean = false
	 *      rows: {[name: string]: ScreenFormRowItem}[]
	 *  }
	 * }} ScreenFormStructure
	 */

	/**
	 * @typedef {{
	 * 	name: string,
	 * 	node: TreeDOM,
	 * 	placeholder: HTMLDivElement
	 * }} ScreenFormGroup
	 */

	/**
	 * @typedef {{
	 *  view: HTMLElement
	 *  name: string
	 *  input: HTMLInputElement
	 *  value
	 * 	label: string
	 *  disabled: boolean
	 * 	visible: boolean
	 * 	setError: (error: string) => void
	 *  dependencies: {
	 *      name: string,
	 *      value
	 *  }[]
	 * }} ScreenFormItem
	 */

	/**
	 * Construct a new form.
	 *
	 * @param   {ScreenFormStructure}   structure
	 * @param   {object}				[options]
	 * @param   {string}				[options.id]
	 * @param   {object}				[options.defaults]
	 * @param   {boolean}				[options.scrollable]
	 * @param   {boolean}				[options.simple]
	 */
	constructor(structure, {
		id,
		defaults,
		scrollable = true,
		simple = false
	} = {}) {
		if (!id)
			id = randString(8);

		this.prefix = `screen-form-${id}`;
		this.structure = structure;
		this.defaultValues = {};
		this.structureDefaults = {};
		this.submitHandler = () => {};
		this.visibleChangeHandlers = [];
		this.resetHandlers = [];

		/** @type {{[groupID: string]: ScreenFormGroup}} */
		this.groups = {};

		this.disabledGroups = {};

		/** @type {{[name: string]: ScreenFormItem}} */
		this.items = {};

		this.content = document.createElement("div");
		this.content.classList.add("content");

		for (const [groupID, group] of Object.entries(structure)) {
			const placeholder = document.createElement("div");
			placeholder.classList.add("group-placeholder");
			placeholder.dataset.id = groupID;
			placeholder.style.display = "none";

			const gView = makeTree("div", "group", {
				header: { tag: "div", class: "header", child: {
					gTitle: { tag: "span", class: "title", text: group.name },
					collapse: { tag: "icon", icon: "caretDown" }
				}},

				content: { tag: "div", class: "content" }
			});

			gView.id = `${this.prefix}-g${groupID}`;

			if (group.collapse)
				gView.classList.add("collapsed");

			gView.header.addEventListener("click", () => {
				// Toggle group collapse
				gView.classList.toggle("collapsed");
			});

			for (const row of group.rows) {
				const rowNode = document.createElement("div");
				rowNode.classList.add("row");

				for (let [name, options] of Object.entries(row)) {
					const item = this.createItem(name, options);
					item.name = name;
					item.group = groupID;
					this.items[name] = item;

					if (item.input) {
						// Only add to list if item has a valid input field.
						// This will make sure we don't add non-input item like note.

						if (typeof options.default !== "undefined") {
							this.structureDefaults[name] = options.default;
							item.value = item.default;
						}
					}

					if (item.visible)
						rowNode.appendChild(item.view);
					else
						rowNode.appendChild(item.placeholder);
				}

				gView.content.appendChild(rowNode);
			}

			this.groups[groupID] = {
				get name() {
					return group.name;
				},

				set name(name) {
					gView.header.gTitle.innerText = name;
					group.name = name;
				},

				node: gView,
				placeholder
			}

			this.content.appendChild(gView);
		}

		this.form = makeTree("form", "screen-form", {
			header: { tag: "div", class: "header", child: {
				fTitle: { tag: "div", class: "title", text: "Form" }
			}},

			content: this.content,
			actions: { tag: "div", class: "actions", child: {
				reset: createButton(app.string("form.reset"), {
					color: "brown",
					type: "button",
					onClick: () => this.reset()
				}),

				submit: createButton(app.string("form.submit"), {
					color: "accent",
					type: "submit"
				})
			}}
		});

		if (scrollable) {
			this.scroll = new Scrollable(this.form, {
				content: this.form.content,
				scrollout: false
			});
		}

		if (simple)
			this.form.classList.add("form-simple");

		// Apply defaults
		if (defaults)
			this.defaults = defaults;

		this.form.addEventListener("submit", (e) => {
			e.preventDefault();
			this.handleSubmit();
		});

		this.reset();
	}

	get container() {
		return this.form;
	}

	/**
	 * Set form title
	 *
	 * @param   {string}    title
	 */
	set title(title) {
		this.form.header.fTitle.innerText = title;
	}

	/**
	 * Show a group in the form and enable it.
	 *
	 * @param	{string}	group
	 */
	enable(group) {
		if (!this.groups[group])
			return this;

		// this.groups[group].node.classList.remove("hidden");
		if (this.content.contains(this.groups[group].placeholder))
			this.content.replaceChild(this.groups[group].node, this.groups[group].placeholder);

		this.disabledGroups[group] = false;
		return this;
	}

	/**
	 * Hide a group in the form and disable it.
	 *
	 * @param	{string}	group
	 */
	disable(group) {
		if (!this.groups[group])
			return this;

		// this.groups[group].node.classList.add("hidden");
		if (this.content.contains(this.groups[group].node))
			this.content.replaceChild(this.groups[group].placeholder, this.groups[group].node);

		this.disabledGroups[group] = true;
		return this;
	}

	/**
	 * Listen for form submit event.
	 *
	 * @param   {(values: {}) => Promise|void}    f
	 */
	onSubmit(f) {
		this.submitHandler = f;
	}

	async handleSubmit() {
		disableInputs(this.form);
		this.form.actions.reset.disabled = true;
		this.form.actions.submit.loading = true;

		try {
			await this.submitHandler(this.values);
		} catch (e) {
			clog("WARN", `ScreenForm().handleSubmit(): An error occured while handing form submit!`, e);
			app.screen.active.handleError(e);
		}

		enableInputs(this.form);
		this.form.actions.reset.disabled = false;
		this.form.actions.submit.loading = false;
	}

	/**
	 * Toggle show input fields in form.
	 *
	 * @param   {boolean}   show
	 */
	set show(show) {
		this.form.classList[show ? "add" : "remove"]("show");

		for (const handler of this.visibleChangeHandlers) {
			try {
				handler(show);
			} catch (e) {
				clog("WARN", `ScreenForm(${this.id}).show: error occured while handling visible change handler`, e);
				continue;
			}
		}
	}

	/**
	 * Listen on form inputs visible change.
	 *
	 * @param	{(show: boolean) => void}	handler
	 */
	onVisibleChange(handler) {
		if (typeof handler !== "function")
			throw new Error(`ScreenForm(${this.id}).onVisibleChange(): not a valid function`);

		this.visibleChangeHandlers.push(handler);
	}

	/**
	 * Set default values.
	 *
	 * @param   {{ [name: string]: any }}   defaults
	 */
	set defaults(defaults) {
		for (let [name, value] of Object.entries(defaults))
			this.defaultValues[name] = value;
	}

	/**
	 * Set values.
	 *
	 * @param   {{ [name: string]: any }}   values
	 */
	set values(values) {
		for (let [name, value] of Object.entries(values)) {
			if (this.items[name])
				this.items[name].value = value;
		}
	}

	get values() {
		const values = {};

		for (let [name, item] of Object.entries(this.items)) {
			if (this.disabledGroups[item.group])
				continue;

			if (item.input && item.input.disabled && !item.input.classList.contains("form-disabled-input"))
				continue;

			if (!item.visible)
				continue;

			values[name] = item.value;
		}

		return values;
	}

	/**
	 * Listen on form value reset.
	 *
	 * @param	{(original: boolean) => void}	handler
	 */
	onReset(handler) {
		if (typeof handler !== "function")
			throw new Error(`ScreenForm(${this.id}).onReset(): not a valid function`);

		this.resetHandlers.push(handler);
	}

	/**
	 * Get and return an input's value.
	 *
	 * @param		{string}	name
	 * @returns		{any}
	 */
	value(name) {
		if (!this.items[name])
			return null;

		const item = this.items[name];

		if (item.input && item.input.disabled && !item.input.classList.contains("form-disabled-input"))
			return undefined;

		if (!item.visible)
			return undefined;

		return item.value;
	}

	/**
	 * Set input's value.
	 *
	 * @param	{string}	name
	 * @param	{any}		value
	 * @returns	{this}
	 */
	setValue(name, value) {
		if (!this.items[name])
			return this;

		this.items[name].value = value;
		return this;
	}

	/**
	 * Set input's error message. Used to show vadilation issue with the value
	 * of the input.
	 *
	 * @param	{string}	name
	 * @param	{string}	message
	 * @returns	{this}
	 */
	setError(name, message) {
		if (!this.items[name])
			return this;

		this.items[name].setError(message);
		return this;
	}

	/**
	 * Reset the form values.
	 *
	 * @param   {boolean}   original    Reset to original default values.
	 */
	reset(original = false) {
		if (original)
			this.defaultValues = { ...this.structureDefaults };

		for (let [name, item] of Object.entries(this.items)) {
			if (typeof this.defaultValues[name] === "undefined") {
				item.value = null;
				continue;
			}

			item.value = this.defaultValues[name];
		}

		for (const handler of this.resetHandlers) {
			try {
				handler(original);
			} catch (e) {
				clog("WARN", `ScreenForm(${this.id}).reset(original = ${original}): error occured while handling handler`, e);
				continue;
			}
		}
	}

	/**
	 * Create a new form item instance.
	 *
	 * @param   {string}            name
	 * @param   {ScreenFormRowItem} item
	 * @return  {ScreenFormItem}
	 */
	createItem(name, {
		type,
		label,
		options,
		help,
		node,
		required = false,
		disabled = false,
		visible = true,
		grow = true,
		dependencies = [],
		onInput = () => {},
		onSetValue = () => {}
	} = {}) {
		const id = `${this.prefix}-${name}`;
		const form = this;
		let item = {};

		let currentVisible = true;

		switch (type) {
			case "text":
			case "number":
			case "float":
			case "email":
			case "textarea":
			case "password": {
				options = {
					type,
					label,
					id,
					animated: true,
					color: "accent",
					required,

					...options
				};

				const input = createInput(options);

				item = {
					content: input.group,
					input: input.input,

					set value(value) {
						input.value = value;

						if (!currentVisible)
							return;

						onSetValue(value, {}, form);
					},

					get value() {
						return input.value;
					},

					set disabled(disabled) {
						input.disabled = disabled;
					},

					get disabled() {
						return input.disabled;
					},

					set label(label) {
						input.set({ label });
					},

					setError: (error) => input.set({ message: error })
				};

				input.onInput((value) => {
					if (!currentVisible)
						return;

					onInput(value, {}, form);
					onSetValue(value, {}, form);
				});

				if (input.unitSelect) {
					this.items[`${name}Unit`] = {
						content: null,
						input: input.unitSelect,

						set value(value) {
							input.unit = value;
						},

						get value() {
							return input.unit;
						},

						set disabled(disabled) {
							input.unitSelect.disabled = disabled;
						},

						get disabled() {
							return input.unitSelect.disabled;
						},

						get visible() {
							return item.visible;
						}
					};
				}

				break;
			}

			case "date": {
				options = {
					type: "date",
					label,
					id,
					animated: true,
					color: "accent",
					enableSwitch: false,
					required,

					...options
				};

				const input = createInput(options);

				item = {
					content: input.group,
					input: input.input,

					set value(value) {
						if (!currentVisible)
							return;

						const date = new Date(value * 1000);
						input.input.value = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(i => pleft(i, 2)).join("-");
						input.input.dispatchEvent(new Event("input"));
						input.input.dispatchEvent(new Event("change"));
						onSetValue(value, {}, form);
					},

					get value() {
						return getDateValue(input.input);
					},

					set disabled(disabled) {
						input.disabled = disabled;
					},

					get disabled() {
						return input.disabled;
					},

					set label(label) {
						input.set({ label });
					},

					setError: (error) => input.set({ message: error })
				};

				input.onInput((value) => {
					if (!currentVisible)
						return;

					onInput(value, {}, form);
					onSetValue(value, {}, form);
				});

				break;
			}

			case "datetime": {
				options = {
					type: "datetime-local",
					label,
					id,
					animated: true,
					color: "accent",
					enableSwitch: false,
					required,

					...options
				};

				const input = createInput(options);

				item = {
					content: input.group,
					input: input.input,

					set value(value) {
						if (!currentVisible)
							return;

						setDateValue(input.input, value);
						input.input.dispatchEvent(new Event("input"));
						input.input.dispatchEvent(new Event("change"));
						onSetValue(value, {}, form);
					},

					get value() {
						return getDateValue(input.input);
					},

					set disabled(disabled) {
						input.disabled = disabled;
					},

					get disabled() {
						return input.disabled;
					},

					set label(label) {
						input.set({ label });
					},

					setError: (error) => input.set({ message: error })
				};

				input.onInput((value) => {
					if (!currentVisible)
						return;

					value = getDateValue(value);
					onInput(value, {}, form);
					onSetValue(value, {}, form);
				});

				break;
			}

			case "select": {
				options = {
					label,
					id,
					name,
					fixed: true,
					color: "accent",
					required,

					...options
				};

				const input = createSelectInput(options);

				const view = makeTree("div", `screen-form-item-select`, {
					label: { tag: "label", text: label },
					input
				});

				item = {
					content: view,
					input: input.input,

					set value(value) {
						if (!currentVisible)
							return;

						input.value = value;
						onSetValue(value, {}, form);
					},

					get value() {
						return input.value;
					},

					set disabled(disabled) {
						input.disabled = disabled;
					},

					get disabled() {
						return input.disabled;
					}
				};

				input.onChange((value) => {
					if (!currentVisible)
						return;

					onInput(value, {}, form);
					onSetValue(value, {}, form);
				});

				break;
			}

			case "checkbox": {
				options = {
					label,
					id,
					color: "accent",

					...options
				};

				const input = createCheckbox(options);

				item = {
					content: input.group,
					input: input.input,

					set value(value) {
						if (!currentVisible)
							return;

						input.input.checked = !!value;
						onSetValue(input.input.checked, { trusted: false }, form);
					},

					get value() {
						return input.input.checked;
					},

					set disabled(disabled) {
						input.input.disabled = disabled;
					},

					get disabled() {
						return input.input.disabled;
					}
				};

				input.input.addEventListener("input", () => {
					if (!currentVisible)
						return;

					onInput(input.input.checked, { trusted: true }, form);
					onSetValue(input.input.checked, { trusted: true }, form);
				});

				break;
			}

			case "note": {
				options = {
					level: "INFO",
					message: "This is the default message for note item.",
					style: "round",

					...options
				};

				const note = createNote(options);

				item = { content: note.group, input: null, value: null }
				break;
			}

			case "node": {
				let content = makeTree("div", "item-node", {
					label: { tag: "label", text: label },
					content: node
				});

				item = {
					content,
					input: null,
					value: null
				}

				break;
			}

			case "autocomplete": {
				options = {
					label,
					id,
					color: "accent",
					required,
					multiple: false,
					animated: true,

					...options
				};

				const input = createAutocompleteInput(options);

				item = {
					content: input.group,
					input: input.input,
					update: input.update,

					set value(value) {
						if (!currentVisible)
							return;

						input.value = value;
						onSetValue(value, {}, form);
					},

					get value() {
						return input.value;
					},

					set disabled(disabled) {
						input.disabled = disabled;
					},

					get disabled() {
						return input.disabled;
					},

					setError: (error) => {
						input.message = error;
					}
				};

				input.onInput((value, options) => {
					if (!currentVisible)
						return;

					onInput(value, options, form);

					if (options.trusted)
						onSetValue(value, options, form);
				});

				break;
			}

			case "picker": {
				const input = new ScreenInstancePicker();

				item = {
					content: input.container,
					input: false,

					set value(value) {
						if (!currentVisible)
							return;

						input.value = value;
						onSetValue(value, {}, form);
					},

					get value() {
						return input.value;
					},

					set disabled(disabled) {
						input.disabled = disabled;
					},

					get disabled() {
						return input.disabled;
					}
				};

				input.onSelected((value, options) => {
					if (!currentVisible)
						return;

					onInput(value, options, form);

					if (options.trusted)
						onSetValue(value, options, form);
				});

				if (typeof options.fetch === "function") {
					input.setFetcher(options.fetch);

					this.onVisibleChange(async (show) => {
						if (!show)
							return;

						await input.update();
					});
				}

				if (typeof options.process === "function")
					input.setProcessor(options.process);

				this.onReset(() => input.reset());
				break;
			}

			default: {
				let content = document.createElement("div");
				content.classList.add("unsupported");
				content.innerText = `Unsupported item type "${type}" (${name})`;

				item = { content, input: null, value: null };
				break;
			}
		}

		item.content.classList.add("content");

		const view = makeTree("div", "item", {
			input: item.content,
			help: (help)
				? { tag: "div", class: "help", html: help }
				: null
		});

		const placeholder = document.createElement("div");
		placeholder.classList.add("placeholder");
		placeholder.style.display = "none";
		placeholder.dataset.for = name;

		Object.defineProperty(item, "visible", {
			set: (value) => {
				value = !!value;

				if (value === currentVisible)
					return;

				currentVisible = value;

				if (currentVisible && placeholder.parentElement) {
					placeholder.parentElement.replaceChild(view, placeholder);
				} else if (!currentVisible && view.parentElement) {
					view.parentElement.replaceChild(placeholder, view);
				}
			},

			get: () => currentVisible
		});

		view.dataset.id = id;
		if (!grow)
			view.classList.add("no-grow");

		item.placeholder = placeholder;
		item.view = view;
		item.dependencies = dependencies;
		item.disabled = disabled;
		item.visible = visible;
		return item;
	}
}

class ScreenCollapsableGroup {
	/**
	 * Initialize a new grid.
	 *
	 * @param	{object}		options
	 * @param	{string}		options.label
	 * @param	{boolean}		options.collapsed
	 * @param	{ScreenSize}	options.size
	 * @param	{boolean}		options.headerLine
	 */
	constructor({
		label = "ScreenCollapsableGroup",
		collapsed = false,
		size = "full",
		headerLine = true
	} = {}) {
		this.container = makeTree("div", "screen-collapsable-group", {
			header: { tag: "div", class: "header", child: {
				icon: { tag: "icon", icon: "caretDown" },
				label: { tag: "span", class: "label", text: label }
			}},

			content: { tag: "div", class: "content" }
		});

		this.container.dataset.size = size;
		this.expanded = true;
		this.container.header.addEventListener("click", () => this.toggle());

		if (headerLine)
			this.container.classList.add("header-line");

		if (collapsed)
			this.collapse();
	}

	/**
	 * Set group label
	 *
	 * @param   {string}    label
	 */
	set label(label) {
		this.container.header.label.innerText = label;
	}

	get label() {
		return this.container.header.label.innerText;
	}

	/**
	 * Set group content
	 *
	 * @param   {string|HTMLElement}    content
	 */
	set content(content) {
		emptyNode(this.container.content);

		if (typeof content === "object" && content.tagName)
			this.container.content.appendChild(content);
		else
			this.container.content.innerHTML = content;
	}

	get content() {
		return this.container.content;
	}

	/**
	 * Set group content
	 *
	 * @param   {string|HTMLElement}    content
	 */
	set content(content) {
		emptyNode(this.container.content);

		if (typeof content === "object" && content.tagName)
			this.container.content.appendChild(content);
		else
			this.container.content.innerHTML = content;
	}

	get content() {
		return this.container.content;
	}

	expand() {
		this.container.classList.remove("collapse");
		this.expanded = true;
	}

	collapse() {
		this.container.classList.add("collapse");
		this.expanded = false;
	}

	toggle() {
		(this.expanded)
			? this.collapse()
			: this.expand();
	}
}

class ScreenGrid {
	/**
	 * @typedef {string|HTMLElement|[display: string, copy: string]} ScreenGridCellValue
	 *
	 * @typedef {{
	 *  label: string
	 *  value: ScreenGridCellValue|((data: ?any) => ScreenGridCellValue|Promise<ScreenGridCellValue>)
	 *  copyable: boolean = false
	 * 	dataName: ?string
	 * 	style: "default" | "heading" | "code"
	 * 	colSpan: null | number | number[] | "all"
	 * }} ScreenGridCell
	 */

	/**
	 * Initialize a new grid.
	 *
	 * @param   {HTMLElement|ScreenPanel}	container
	 * @param   {ScreenGridCell[]}			cells
	 * @param   {object}					options
	 * @param   {ScreenSize}				options.size
	 * @param   {number|number[]}			options.columns
	 * @param   {"default"|"statistics"}	options.style
	 * @param   {?ScreenChild}				options.screen		Screen containing this element for responsive updating.
	 */
	constructor(container, cells, {
		size = "full",
		columns = 2,
		style = "default",
		screen = null
	} = {}) {
		this.container = document.createElement("div");
		this.container.classList.add("screen-grid");
		this.container.dataset.size = size;
		this.container.dataset.style = style;

		/**
		 * @type {{
		 *  cell: TreeDOM
		 *  update: () => Promise<void>
		 *  loading: boolean
		 * 	dataName: ?string
		 * 	colSpan: null | number[]
		 * }[]}
		 */
		this.cells = [];

		this.columns = columns;

		/** @type {{f: () => any|Promise<any>, n: string|null, r: string[]}[]} */
		this.updateHandlers = [];

		for (const { label, value, copyable, dataName = null, style = "default", colSpan = null } of cells) {
			const cell = makeTree("div", "cell", {
				label: { tag: "div", class: "label", text: label },

				content: { tag: "div", class: "content", child: {
					copy: (copyable)
						? { tag: "icon", icon: "copy", class: "copy" }
						: null,

					display: { tag: "span", class: "display" }
				}}
			});

			let isLoading = false;
			let copyContent = null;

			let spinner = document.createElement("div");
			spinner.classList.add("simpleSpinner");

			const setLoading = (loading = false) => {
				if (typeof value !== "function")
					return;

				if (loading === isLoading)
					return;

				if (loading)
					cell.content.insertBefore(spinner, cell.content.firstChild);
				else
					cell.content.removeChild(spinner);

				isLoading = loading;
			}

			const update = async (data) => {
				let val = value;
				let hasCopyable = false;

				if (typeof value === "function") {
					setLoading(true);

					try {
						val = await value(data);
					} catch (e) {
						let error = parseException(e);
						val = ScreenUtils.renderStatus("ERROR", error.description);
						clog("WARN", `ScreenGrid(${label}): Error occured while fetching cell value:`, e);
					}

					setLoading(false);
				}

				if (Array.isArray(val)) {
					copyContent = val[1];
					val = val[0];
					hasCopyable = true;
				}

				if (isElement(val)) {
					// Only re-append value node if it's not already in
					// value display node.
					if (!cell.content.display.contains(val)) {
						emptyNode(cell.content.display);
						cell.content.display.appendChild(val);
					}
				} else {
					if (val === null || val === "") {
						emptyNode(cell.content.display);
						cell.content.display.appendChild(ScreenUtils.renderEmpty());
					} else {
						cell.content.display.innerHTML = val;
					}

					if (!hasCopyable)
						copyContent = val;
				}
			}

			setLoading(true);

			if (typeof value !== "function")
				update();

			if (copyable) {
				let resetCopyButton = null;

				const tooltipContent = document.createElement("div");
				tooltipContent.innerText = app.string("clipboard_copy");
				tooltip.register(cell.content.copy, tooltipContent, { position: "top" });

				cell.content.copy.addEventListener("click", () => {
					if (!copyContent)
						return;

					navigator.clipboard.writeText(copyContent);
					cell.content.copy.dataset.icon = "circleCheck";
					cell.content.copy.dataset.color = "blue";
					cell.content.copy.classList.add("style-solid");
					tooltipContent.innerText = app.string("clipboard_copied");

					clearTimeout(resetCopyButton);
					resetCopyButton = setTimeout(() => {
						cell.content.copy.dataset.icon = "copy";
						cell.content.copy.dataset.color = null;
						cell.content.copy.classList.remove("style-solid");
						tooltipContent.innerText = app.string("clipboard_copy");
					}, 3000);
				});
			}

			const instance = {
				cell,
				update,
				dataName,
				colSpan: null,

				set loading(loading) {
					setLoading(loading);
				}
			};

			cell.dataset.style = style;

			if (typeof colSpan === "number" || colSpan === "all") {
				// Set column span numbers directly.
				cell.style.setProperty("--col-span", (colSpan === "all") ? `1 / -1` : `span ${colSpan}`);
			} else if (colSpan && typeof colSpan === "object" && colSpan.length === 3) {
				// Let the screen mode change listener handle the column span update.
				instance.colSpan = colSpan;
			}

			this.cells.push(instance);
			this.container.appendChild(cell);
		}

		if (container) {
			if (container instanceof ScreenPanel) {
				container.content.appendChild(this.container);

				if (!screen)
					screen = container.parent;

			} else if (isElement(container))
				container.appendChild(this.container);
		}

		this.loaded = false;

		if (typeof this.columns === "number") {
			// Set column numbers directly.
			this.container.style.setProperty("--columns", this.columns);
		} else if (this.columns && typeof this.columns === "object" && this.columns.length === 3) {
			(screen ? screen : app).onScreenModeChange((size) => {
				this.container.style.setProperty("--columns", {
					"desktop": this.columns[0],
					"tablet": this.columns[1],
					"mobile": this.columns[2]
				}[size]);

				for (const { cell, colSpan } of this.cells) {
					if (!colSpan)
						continue;

					const value = {
						"desktop": colSpan[0],
						"tablet": colSpan[1],
						"mobile": colSpan[2]
					}[size];

					cell.style.setProperty("--col-span", (value === "all") ? `1 / -1` : `span ${value}`);
				}
			});
		}
	}

	/**
	 * Listen when info is being updated.
	 *
	 * @param   {() => Promise<any>|any}	f				Update listener function
	 * @param   {string|null}				dataName		Data name
	 * @param   {string[]}					requirements	Requirements to start calling this function
	 */
	onUpdate(f, dataName = null, requirements = []) {
		this.updateHandlers.push({
			f,
			n: dataName,
			r: requirements
		});

		return this;
	}

	/**
	 * Set cells loading state.
	 *
	 * @param {boolean} loading
	 */
	set loading(loading) {
		for (let cell of this.cells)
			cell.loading = loading;
	}

	async update() {
		this.loading = true;
		const promises = [];
		const namedPromises = {};
		const generalPromises = [];
		const cellPromises = [];

		// Sort by requirements so that requirement will be handled correctly.
		// We need to bring all un-named handlers to front to let them fetch first.
		let handlers = this.updateHandlers.sort((a, b) => {
			return (a.r.length - (a.n ? 0 : 100))
				- (b.r.length - (b.n ? 0 : 100));
		});

		for (let handler of handlers) {
			let promise = (async () => {
				let p = [];
				if (handler.r && handler.r.length > 0) {
					for (let r of handler.r)
						p = namedPromises[r];

					await Promise.all(p);
				}

				if (generalPromises.length > 0)
					await Promise.all(generalPromises);

				return await handler.f();
			})();

			promises.push(promise);

			if (handler.n)
				namedPromises[handler.n] = promise;
			else
				generalPromises.push(promise);
		}

		for (let cell of this.cells) {
			let promise;

			if (cell.dataName && namedPromises[cell.dataName]) {
				promise = (async () => {
					let data = await namedPromises[cell.dataName];
					await cell.update(data);
				})();
			} else {
				promise = (async () => {
					await Promise.all(generalPromises);
					await cell.update();
				})();
			}

			cellPromises.push(promise);
		}

		await Promise.all(generalPromises);
		await Promise.all(cellPromises);
		this.loaded = true;
	}
}

class ScreenInfoGrid {
	/**
	 * @typedef {{
	 *  [id: string]: {
	 *      label: string
	 * 		columns: number|number[]
	 *      collapsed: boolean = false
	 * 		headerLine: boolean = true,
	 *      items: ScreenGridCell[]
	 *      node: HTMLElement
	 *  }
	 * }} ScreenInfoGridItems
	 */

	/**
	 * Initialize a new grid.
	 *
	 * @param	{HTMLElement|ScreenPanel|ScreenChild}	container
	 * @param	{ScreenInfoGridItems}					structure
	 * @param	{object}								options
	 * @param	{ScreenSize}							options.size
	 * @param	{number|number[]}						options.columns
	 * @param	{boolean}								options.headerLine
	 * @param   {?ScreenChild}							options.screen		Screen containing this element for responsive updating.
	 */
	constructor(container, structure, {
		size = "full",
		columns = [4, 3, 2],
		headerLine = true,
		screen = null
	} = {}) {
		this.container = document.createElement("div");
		this.container.classList.add("screen-info-grid");
		this.container.dataset.size = size;

		/** @type {{ [id: string]: { container: TreeDOM, collapseGroup: ScreenCollapsableGroup, grid: ?ScreenGrid } }} */
		this.groups = {};

		/** @type {{f: () => any|Promise<any>, n: string|null, r: string[]}[]} */
		this.updateHandlers = [];

		/** @type {ScreenGrid[]} */
		this.grids = [];

		// Try to get ScreenChild from parent.
		if (!screen && container) {
			if (container instanceof ScreenPanel)
				screen = container.parent;
			else if (container instanceof ScreenChild)
				screen = container;
		}

		if (screen && !(screen instanceof ScreenChild)) {
			clog("WARN", `ScreenInfoGrid(): screen is not a valid ScreenChild. Falling back to empty.`);
			screen = null;
		}

		for (const [id, group] of Object.entries(structure)) {
			const { label, collapsed = false, items } = group;
			let node = group.node;

			const collapseGroup = new ScreenCollapsableGroup({
				label,
				collapsed,
				headerLine: (typeof group.headerLine !== "undefined")
					? group.headerLine
					: headerLine
			});

			collapseGroup.container.classList.add("group");
			this.container.appendChild(collapseGroup.container);

			if (typeof node === "object") {
				if (node.container && isElement(node.container))
					node = node.container;
				else if (node.content && isElement(node.content))
					node = node.content;

				if (isElement(node)) {
					collapseGroup.content.appendChild(node);

					this.groups[id] = {
						container: collapseGroup.container,
						collapseGroup,
						grid: null
					}

					continue;
				}
			}

			const grid = new ScreenGrid(collapseGroup.content, items, {
				size,
				columns: (group.columns) ? group.columns : columns,
				screen
			});

			this.groups[id] = {
				container: collapseGroup.container,
				collapseGroup,
				grid
			}

			this.grids.push(grid);
		}

		if (container) {
			if (container instanceof ScreenPanel || container instanceof ScreenChild)
				container.content.appendChild(this.container);
			else if (isElement(container))
				container.appendChild(this.container);
		}

		this.loaded = false;
	}

	/**
	 * Listen when info is being updated.
	 *
	 * @param   {() => Promise<any>|any}	f				Update listener function
	 * @param   {string|null}				dataName		Data name
	 * @param   {string[]}					requirements	Requirements to start calling this function
	 */
	onUpdate(f, dataName = null, requirements = []) {
		this.updateHandlers.push({
			f,
			n: dataName,
			r: requirements
		});

		return this;
	}

	/**
	 * Set loading state.
	 *
	 * @param	{boolean}	loading
	 */
	set loading(loading) {
		for (let grid of this.grids)
			grid.loading = loading;
	}

	async update() {
		let promises = [];
		let namedPromises = {};
		this.loading = true;

		for (let handler of this.updateHandlers) {
			let promise = handler.f();

			if (handler.n)
				namedPromises[handler.n] = promise;
			else
				promises.push(promise);
		}

		for (let grid of this.grids) {
			grid.updateHandlers = [];
			grid.updateHandlers.push({
				f: () => Promise.all(promises),
				n: null,
				r: []
			});

			for (let handler of this.updateHandlers) {
				if (!handler.n)
					continue;

				grid.updateHandlers.push({
					f: async () => {
						await Promise.all(promises);
						return await namedPromises[handler.n];
					},
					n: handler.n,
					r: handler.r
				});
			}
		}

		await Promise.all(this.grids.map((grid) => grid.update()));
		this.loaded = true;
	}
}

class DataPipe {
	/**
	 * @typedef {{
	 *  index: number
	 *  level: "OKAY" | "INFO" | "WARN" | "ERROR"
	 *  progress: number
	 *  message: string
	 *  data: object
	 * }} DataPipeItem
	 */

	/**
	 * Create a new data pipe between server and client.
	 *
	 * @param   {string}									url
	 * @param   {object}									options
	 * @param   {"GET" | "POST" | "PUT" | "DELETE"}			[options.method="GET"]		Request Method
	 * @param   {{[key: string]: string}}					[options.query]				Query/Param
	 * @param   {{[key: string]: string}}					[options.form]				Form Data
	 */
	constructor(url, {
		method = "GET",
		query = {},
		form = {}
	} = {}) {
		this.url = url;
		this.method = method.toUpperCase();

		let builtQuery = []
		for (let key of Object.keys(query))
			builtQuery.push(`${key}=` + encodeURIComponent(query[key]));

		this.url += (builtQuery.length > 0) ? `?${builtQuery.join("&")}` : "";

		this.form = new FormData();
		for (let key of Object.keys(form))
			this.form.append(key, form[key]);

		this.updateHandlers = [];
		this.startHandlers = [];
		this.endHandlers = [];
	}

	/**
	 * Listen for new data from server.
	 *
	 * @param   {(item: DataPipeItem) => void}  f
	 * @returns {this}
	 */
	onUpdate(f) {
		this.updateHandlers.push(f);
		return this;
	}

	/**
	 * Listen for when data pipe is started.
	 *
	 * @param   {() => void}    f
	 * @returns {this}
	 */
	onStart(f) {
		this.startHandlers.push(f);
		return this;
	}

	/**
	 * Listen for when data pipe is closed.
	 *
	 * @param   {(data: object) => void}    f
	 * @returns {this}
	 */
	onEnded(f) {
		this.endHandlers.push(f);
		return this;
	}

	handleLine(content) {
		if (content === "START") {
			this.startHandlers.forEach(f => f());
			return;
		}

		if (content.startsWith("END")) {
			let [, data] = content.split("|||");
			data = JSON.parse(data);
			this.endHandlers.forEach(f => f(data));
			return;
		}

		let [index, level, progress, message, data] = content.split("|||");

		let item = {
			index: parseInt(index),
			level: ["OKAY", "INFO", "WARN", "ERROR"][level],
			progress: parseFloat(progress),
			message,
			data: JSON.parse(data)
		};

		clog("DEBG", `DataPipe: Recv`, item);
		this.triggerUpdate(item);
	}

	triggerUpdate(item) {
		for (let f of this.updateHandlers) {
			try {
				f(item);
			} catch (e) {
				clog("WARN", `DataPipe: Recv process update hander failed!`, e);
			}
		}
	}

	async start() {
		let queue = "";

		try {
			return await fetch(this.url, {
				method: this.method,
				headers: {
					"Accept": "text/plain;charset=utf-8"
				},
				body: (this.method !== "GET")
					? this.form
					: null
			}).then((response) => {
				const reader = response.body.getReader();
				const decoder = new TextDecoder();

				return new ReadableStream({
					start: (controller) => {
						const pump = () => {
							return reader.read().then(({ done, value }) => {
								// When no more data needs to be consumed, close the stream
								if (done) {
									controller.close();
									return;
								}

								queue += decoder.decode(value);
								let lines = queue.split("\n");

								for (let i = 0; i < lines.length; i++) {
									let line = lines[i].trim();

									// This line might have not completely streamed. Ignore it for now.
									if (!line.startsWith(">>>") || !line.endsWith("<<<"))
										continue;

									let content = line.substring(3, line.length - 3);
									this.handleLine(content);

									lines.splice(i, 1);
									i -= 1;
									continue;
								}

								queue = lines.join("\n");

								if (queue)
									clog("DEBG", "DataPipe: Unprocessed data:", queue);

								// Enqueue the next data chunk into our target stream
								controller.enqueue(value);

								// eslint-disable-next-line consistent-return
								return pump();
							});
						}

						return pump();
					},
				});
			})
			.then((stream) => new Response(stream))
			.then((response) => response.text());
		} catch (e) {
			let error = parseException(e);
			this.triggerUpdate({
				index: -1,
				level: "ERROR",
				progress: 1,
				message: `[${error.code}] ${error.description}`,
				data: error
			});

			throw e;
		}
	}
}

class DataPipeUI {
	/**
	 * Data Pipe UI consisting of a progress bar and
	 * a log window.
	 *
	 * @param   {DataPipe}  pipe
	 */
	constructor(pipe) {
		this.pipe = pipe;

		this.progressBar = createProgressBar();
		this.beat = false;
		this.currentProgress = 0;

		/** @type {Animator} */
		this.animator = null;

		this.animateTimeout = null;

		this.container = makeTree("div", "data-pipe-ui", {
			progress: this.progressBar,
			logs: { tag: "div", class: "logs" }
		});

		this.progressBar.set({ blink: "fade", left: `0.000%` });
		this.pipe.onUpdate((item) => this.log(item));

		this.pipe.onStart(() => {
			this.log({ index: 0, level: "OKAY", progress: 0, message: "Data pipe connected!" });
			this.progressBar.set({ blink: "none" });
		});
	}

	log({ index, level, progress, message }) {
		const log = makeTree("div", "log", {
			level: { tag: "span", class: "level", text: level },
			message: { tag: "span", class: "message", text: message }
		});

		log.dataset.index = index;
		log.dataset.level = level;
		this.container.logs.appendChild(log);
		this.container.logs.scrollTop = this.container.logs.scrollHeight - this.container.logs.offsetHeight;

		while (this.container.logs.childElementCount > 50)
			this.container.logs.removeChild(this.container.logs.firstChild);

		this.progressBar.progress(progress * 100);

		if (level === "ERROR" && progress >= 1)
			this.progressBar.set({ color: "red", blink: "grow" });

		if (progress !== this.currentProgress) {
			let targetProgress = progress;
			clearTimeout(this.animateTimeout);

			this.animateTimeout = setTimeout(() => {
				if (this.animator) {
					this.animator.cancel();
					this.animator = null;
				}

				let pStart = this.currentProgress;
				this.animator = new Animator(0.3, Easing.OutCubic, (t) => {
					this.currentProgress = pStart + (targetProgress - pStart) * t;
					this.progressBar.set({ left: (this.currentProgress * 100).toFixed(3) + "%" });
				});
			});
		}

		this.beat = !this.beat;
		this.progressBar.beat(this.beat);
	}

	async start() {
		this.log({ index: -1, level: "INFO", progress: 0, message: "Starting data pipe..." });
		await this.pipe.start();
	}
}

class DataPipePopup {
	/**
	 * Create a new data pipe popup.
	 *
	 * @param   {DataPipe}          pipe
	 * @param   {object}            options
	 * @param   {"light" | "dark"}  theme
	 */
	constructor(pipe, {
		title = "DataPipePopup",
		message = "Running",
		icon = "circle",
		color = "accent",
		theme = "light"
	} = {}) {
		this.pipe = pipe;
		this.title = title;
		this.message = message;
		this.icon = icon;
		this.color = color;
		this.theme = theme;
	}

	async start() {
		let ui = new DataPipeUI(this.pipe);

		popup.show({
			windowTitle: "Data Pipe",
			title: this.title,
			message: this.message,
			icon: this.icon,
			bgColor: this.color,
			headerTheme: this.theme,
			cancelable: false,
			customNode: ui.container,
			buttons: {
				close: {
					text: app.string("button.close"),
					color: "blue"
				}
			}
		});

		popup.buttons.close.style.display = "none";
		await ui.start();
		popup.buttons.close.style.display = null;
	}
}

class ScreenImportWizard {
	constructor({
		url,
		query = {},
		primary = "id",
		subject = "Sample",
		sampleFileUrl = "#"
	} = {}) {
		this.id = `screen-import-wizard-` + randString(8);
		this.url = url;
		this.query = query;
		this.primary = primary;
		this.subject = subject;
		this.sampleFileUrl = sampleFileUrl;

		this.completedHandlers = [];
		this.endedHandlers = [];

		this.initUploadScreen();
		this.initVerifyScreen();
		this.initImportScreen();

		this.container = makeTree("div", "screen-import-wizard", {
			steps: { tag: "div", class: "steps", child: {
				upload: { tag: "div", class: ["step", "upload"], text: app.string("import_step_upload") },
				verify: { tag: "div", class: ["step", "verify"], text: app.string("import_step_verify") },
				import: { tag: "div", class: ["step", "import"], text: app.string("import_step_import") }
			}},

			screens: { tag: "div", class: "screens" }
		});

		this.importID = null;
		this.activeScreen = null;
		this.step = 1;
	}

	/**
	 * Listen for import completed event.
	 *
	 * @param   {() => void}    f
	 * @returns {this}
	 */
	onCompleted(f) {
		this.completedHandlers.push(f);
		return this;
	}

	/**
	 * Listen for import wizard ended event.
	 *
	 * @param   {() => void}    f
	 * @returns {this}
	 */
	onEnded(f) {
		this.endedHandlers.push(f);
		return this;
	}

	initUploadScreen() {
		this.uploadScreen = makeTree("div", ["screen", "upload"], {
			info: { tag: "div", class: "info", child: {
				heading: { tag: "div", class: "title", text: app.string("import_upload_title") },
				description: { tag: "div", class: "description", html: app.string("import_upload_description") },

				input: { tag: "input", type: "file", class: "file-input", id: this.id },
				choose: createButton(app.string("import_upload_file_button"), {
					element: "label",
					color: "blue",
					icon: "file",
					classes: "file-picker"
				}),

				maxSize: { tag: "div", class: "maxSize", text: app.string("import_upload_maxSize", { size: convertSize(app.data.maxSize) }) },

				sampleNote: createNote({
					level: "info",
					message: makeTree("div", "import-upload-sample", {
						message: { tag: "div", text: app.string("import_upload_sample_message") },
						button: createButton(app.string("import_upload_sample_button", { name: this.subject }), {
							icon: "download",
							onClick: () => window.open(this.sampleFileUrl)
						})
					})
				})
			}}
		});

		this.uploadScreen.info.input.accept = `application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
		this.uploadScreen.info.input.multiple = false;
		this.uploadScreen.info.choose.htmlFor = this.id;

		this.uploadScreen.addEventListener("dragover", (e) => {
			e.preventDefault();

			this.uploadScreen.classList.add("dragging");
		});

		this.uploadScreen.addEventListener("dragleave", (e) => {
			e.preventDefault();

			this.uploadScreen.classList.remove("dragging");
		});

		this.uploadScreen.addEventListener("drop", (e) => {
			e.preventDefault();
			this.uploadScreen.classList.remove("dragging");

			/** @type {?File} */
			let file = null;

			if (e.dataTransfer.items) {
				for (let item of e.dataTransfer.items) {
					if (item.kind === "file") {
						file = item.getAsFile();
						break;
					}
				}
			} else {
				// Use DataTransfer interface to access the file(s)
				file = e.dataTransfer.files[0];
			}

			if (!file)
				return;

			this.fileSelected(file);
		});

		this.uploadScreen.info.input.addEventListener("input", (e) => {
			if (!e.target.files || !e.target.files[0])
				return;

			this.fileSelected(e.target.files[0]);
		});
	}

	initVerifyScreen() {
		this.verifyTable = new ScreenTable(null);

		this.verifyTable.setProcessor((name, value, item) => {
			switch (name) {
				case "status": {
					const status = document.createElement("div");
					status.classList.add("screen-import-wizard-messages");

					if (item.messages && item.messages.length > 0) {
						for (let { level, message } of item.messages) {
							level = {
								"info": "INFO",
								"warning": "WARN",
								"error": "ERROR"
							}[level];

							const m = ScreenUtils.renderStatus(level, message);
							status.appendChild(m);
						}
					} else {
						const m = ScreenUtils.renderStatus("OKAY", app.string("import_verify_good"));
						status.appendChild(m);
					}

					return status;
				}
			}

			return null;
		});

		this.verifyNote = createNote({
			level: "info",
			message: `Checking for importability`
		});

		this.verifyBack = createButton(app.string("button.back"), {
			onClick: () => this.reset()
		});

		this.verifyErrorReport = createButton(app.string("response.errorReport"), {
			color: "red",
			icon: "externalLink"
		});

		this.verifyConfirm = createButton(app.string("button.confirm"), {
			color: "green",
			onClick: async () => await this.startImport()
		});

		this.verifyScreen = makeTree("div", ["screen", "verify"], {
			checking: { tag: "div", class: "checking", child: {
				heading: { tag: "div", class: "title", child: {
					spinner: { tag: "span", class: "simpleSpinner" },
					text: { tag: "span", class: "text", text: app.string("import_verifying") }
				}},

				sub: { tag: "div", class: "sub", text: app.string("import_verifying_details") }
			}},

			errored: { tag: "div", class: "errored", child: {
				heading: { tag: "div", class: "title" },
				sub: { tag: "div", class: "sub" },

				actions: { tag: "div", class: "actions", child: {
					back: createButton(app.string("button.back"), {
						onClick: () => this.reset()
					})
				}}
			}},

			verify: { tag: "div", class: "verify", child: {
				header: { tag: "div", class: "header", child: {
					titleNode: { tag: "div", class: "title", text: app.string("import_verify") },
					sub: { tag: "div", class: "sub", text: app.string("import_verify_details") },
					importID: { tag: "div", class: "import-id", text: app.string("import_importID", { id: "none" }) },

					note: this.verifyNote
				}},

				table: this.verifyTable,

				actions: { tag: "div", class: "actions", child: {
					back: this.verifyBack
				}}
			}}
		});
	}

	initImportScreen() {
		this.importComplete = createButton(app.string("button.complete"), {
			color: "green",
			icon: "check",
			onClick: () => {
				this.reset();
				this.endedHandlers.forEach((f) => f());
			}
		});

		this.importNote = createNote({
			level: "warning",
			message: app.string("import_importing_notice")
		});

		this.importScreen = makeTree("div", ["screen", "import"], {
			header: { tag: "div", class: "header", child: {
				titleNode: { tag: "div", class: "title" },
				sub: { tag: "div", class: "sub" },
				importID: { tag: "div", class: "import-id", text: app.string("import_importID", { id: "none" }) },

				note: this.importNote
			}},

			progress: { tag: "div", class: "progress" },

			actions: { tag: "div", class: "actions", child: {
				complete: this.importComplete
			}}
		});
	}

	reset() {
		this.importID = null;
		this.uploadScreen.info.input.value = null;
		this.importComplete.style.display = "none";
		this.step = 1;
	}

	/**
	 * Handle file selected.
	 *
	 * @param   {File}  file
	 */
	async fileSelected(file) {
		this.step = 2;
		this.verifyScreen.dataset.screen = "checking";
		let response;

		try {
			response = (await myajax({
				url: this.url,
				method: "POST",
				query: this.query,
				form: {
					action: "verify",
					file
				}
			})).data;
		} catch (error) {
			let { code, description } = parseException(error);
			this.verifyScreen.dataset.screen = "errored";
			this.verifyScreen.errored.heading.innerText = app.string("import_verify_errored");
			this.verifyScreen.errored.sub.innerHTML = `[${code}]: ${description}`;

			if (error.data.report) {
				this.verifyErrorReport.onclick = () => window.open(error.data.report, "_blank");
				this.verifyScreen.errored.actions.appendChild(this.verifyErrorReport);
			} else {
				if (this.verifyScreen.errored.actions.contains(this.verifyErrorReport))
					this.verifyScreen.errored.actions.removeChild(this.verifyErrorReport);
			}

			return;
		}

		let data = [];
		let header = { line: "#", status: app.string("status") };

		for (let item of response.header)
			header[item] = item;

		for (let row of response.rows) {
			let status = 0;

			if (row.messages && row.messages.length > 0) {
				for (let { level } of row.messages) {
					status += {
						"warning": 1,
						"error": 2
					}[level];
				}
			}

			data.push({
				line: row.line,
				status,
				...row.values,
				messages: row.messages
			});
		}

		if (response.canImport) {
			this.verifyNote.set({
				level: "okay",
				message: app.string("import_verify_importable")
			});

			this.verifyScreen.verify.actions.appendChild(this.verifyConfirm);
		} else {
			this.verifyNote.set({
				level: "warning",
				message: app.string("import_verify_not_importable")
			});

			if (this.verifyScreen.verify.actions.contains(this.verifyConfirm))
				this.verifyScreen.verify.actions.removeChild(this.verifyConfirm);
		}

		response.header.unshift("#");
		this.id = response.id;
		this.verifyTable.header = header;
		this.verifyTable.data = data;
		this.verifyScreen.verify.header.importID.innerText = app.string("import_importID", { id: this.id });

		this.verifyScreen.dataset.screen = "verify";
	}

	async startImport() {
		if (!this.id)
			return;

		let pipe = new DataPipe(this.url, {
			method: "POST",
			query: this.query,
			form: {
				action: "import",
				id: this.id
			}
		});

		let reportUI = new DataPipeUI(pipe);
		let imported = 0;
		let endedData = {};

		pipe.onEnded((data) => {
			imported = data.imported;
			endedData = data;
		});

		emptyNode(this.importScreen.progress);
		this.importScreen.progress.appendChild(reportUI.container);

		this.importScreen.header.titleNode.innerText = app.string("import_importing");
		this.importScreen.header.sub.innerText = app.string("import_importing_details");
		this.importScreen.header.importID.innerText = app.string("import_importID", { id: this.id });

		this.step = 3;
		await reportUI.start();

		this.importScreen.header.titleNode.innerText = app.string("import_imported");
		this.importScreen.header.sub.innerText = app.string("import_imported_details", {
			count: imported,
			subject: this.subject
		});

		this.container.steps.import.classList.add("complete");
		this.container.steps.import.classList.remove("current");
		this.importComplete.style.display = null;
		this.completedHandlers.forEach((f) => f(endedData));
	}

	/**
	 * Set current active step number.
	 *
	 * @param   {number}  step
	 */
	set step(step) {
		if (this.activeScreen)
			this.container.screens.removeChild(this.activeScreen);

		switch (step) {
			case 1:
				this.container.steps.upload.classList.add("current");
				this.container.steps.upload.classList.remove("complete");
				this.container.steps.verify.classList.remove("current", "complete");
				this.container.steps.import.classList.remove("current", "complete");
				this.activeScreen = this.uploadScreen;
				break;

			case 2:
				this.container.steps.verify.classList.add("current");
				this.container.steps.verify.classList.remove("complete");
				this.container.steps.upload.classList.remove("current");
				this.container.steps.upload.classList.add("complete");
				this.container.steps.import.classList.remove("current", "complete");
				this.activeScreen = this.verifyScreen;
				break;

			case 3:
				this.container.steps.import.classList.add("current");
				this.container.steps.import.classList.remove("complete");
				this.container.steps.upload.classList.remove("current");
				this.container.steps.upload.classList.add("complete");
				this.container.steps.verify.classList.remove("current");
				this.container.steps.verify.classList.add("complete");
				this.activeScreen = this.importScreen;
				break;
		}

		this.container.screens.appendChild(this.activeScreen);
	}
}

class ScreenTab {
	/**
	 * @typedef {{
	 *  id: string
	 *  title: string
	 *  icon: ?string
	 *  content: HTMLElement
	 *  tab: TreeDOM
	 *  activate: (trusted: boolean) => void
	 *  deactivate: (trusted: boolean) => void
	 *  activated: boolean
	 *  setDisabled: (disabled: boolean, trusted: boolean) => void
	 * 	disabled: boolean
	 * }} ScreenTabItem
	 *
	 * @typedef {{
	 * 	activated: boolean,
	 * 	trusted: boolean
	 * }} ScreenTabState
	 */

    /**
     * Create a new tab component.
     *
     * @param   {HTMLElement}												container
     * @param   {object}													options
	 * @param	{"default" | "compact"}										[options.style]			Tab display style.
	 * @param   {HTMLElement}   											[options.fullHeight]	Make the tab container take full height from container when possible.
	 * @param   {HTMLElement}   											[options.spacing]		Tab content spacing, will add space around content when set to true.
	 * @param   {(instance: ScreenTabItem, state: ScreenTabState) => void}	[options.onChange]		Handler function when tab state changed.
     */
    constructor(container, {
		fullHeight = false,
		style = "default",
		spacing = false,
		onChange = null
    } = {}) {
        this.container = makeTree("div", "screen-tab", {
            tabs: { tag: "div", class: "tabs" },
            content: { tag: "div", class: "content" }
        });

		this.container.dataset.style = style;
		this.changeHandler = onChange;

        if (fullHeight) {
            this.container.classList.add("full-height");

			this.scroll = new Scrollable(this.container, {
				content: this.container.content,
				scrollout: false
			});
		}

        /** @type {{[name: string]: ScreenTabItem}} */
        this.tabs = {};

		/** @type {ScreenTabItem} */
		this.activated = null;

		/** @type {ScreenTabItem} */
		this.defaultTab = null;

		this.spacing = spacing;

		if (isElement(container))
			container.appendChild(this.container);
	}

	/**
	 * Handle on tab change event.
	 *
	 * @param	{(instance: ScreenTabItem, state: ScreenTabState) => void}	handler
	 * @returns	{this}
	 */
	onChange(handler) {
		if (typeof handler !== "function")
			throw new Error(`ScreenTab().onChange(): not a valid function`);

		this.changeHandler = handler;
		return this;
	}

	/**
	 * Add a new tab.
	 *
	 * @param	{object}														options
	 * @param	{string}														options.id				Tab id.
	 * @param	{string}														options.title			Tab name.
	 * @param	{string}														options.icon			Tab icon.
	 * @param	{string}														[options.icon]			Tab icon, use naming in `FontAwesome.css`.
	 * @param	{?HTMLElement}													[options.content]		Tab content, will be shown when tab is active.
	 * @param	{HTMLElement}													[options.spacing]		Add space around content when set to true.
	 * @param	{(instance: ScreenTabItem) => void}								options.onActive		Tab active listener.
	 * @param	{(instance: ScreenTabItem) => void}								options.onDeactive		Tab deactive listener.
	 * @param	{(state: ScreenTabState, instance: ScreenTabItem) => void}		options.onStateChange	Tab state change listener.
	 * @returns	{this}
	 */
	add({
		id,
		title,
		icon,
		content = null,
		spacing = this.spacing,
		onActive = () => {},
		onDeactive = () => {},
		onStateChange = () => {},
	} = {}) {
		const tab = makeTree("span", "tab", {
			icon: (typeof icon === "string")
				? { tag: "icon", icon }
				: null,

			label: { tag: "span", class: "label" }
		});

		if (content) {
			if (!isElement(content)) {
				if (typeof content !== "object")
					throw new Error(`ScreenTab().add(${id}): content is not a valid element!`);

				if (content.container && isElement(content.container))
					content = content.container;
				else if (content.content && isElement(content.content))
					content = content.content;
				else
					throw new Error(`ScreenTab().add(${id}): content is not a valid element!`);
			}

			content.classList.add("tab-content");
		}

		let currentTitle = null;
		let activated = false;
		let disabled = false;

		const activate = (trusted = false) => {
			if (activated || disabled)
				return;

			if (this.activated)
				this.activated.deactivate(trusted);

			tab.classList.add("active");

			if (content) {
				content.classList.add("active");
				this.container.content.appendChild(content);
			}

			this.container.content.classList[spacing ? "add" : "remove"]("spacing");
			this.activated = instance;

			activated = true;
			onStateChange({ activated, trusted }, instance);

			if (this.changeHandler)
				this.changeHandler(instance, { activated, trusted });

			if (trusted)
				onActive(instance);
		};

		const deactivate = (trusted = false) => {
			if (!activated)
				return;

			tab.classList.remove("active");

			if (content) {
				content.classList.remove("active");
				this.container.content.removeChild(content);
			}

			activated = false;
			this.activated = null;
			onStateChange({ activated, trusted }, instance);

			if (this.changeHandler)
				this.changeHandler(instance, { activated, trusted });

			if (trusted)
				onDeactive(instance);
		};

		const setDisabled = (isDisabled, trusted = false) => {
			tab.classList[isDisabled ? "add" : "remove"]("disabled");
			disabled = isDisabled;

			if (isDisabled && this.activated && this.activated.id === id) {
				this.activated.deactivate(trusted);

				if (this.defaultTab)
					this.defaultTab.activate(trusted);
			}
		}

		tab.addEventListener("click", () => activate(true));

		const instance = {
			id,
			icon,
			content,
			tab,
			activate,
			deactivate,
			setDisabled,

			get activated() {
				return activated;
			},

			set activated(value) {
				value ? activate() : deactivate();
			},

			/**
			 * Get the title element.
			 *
			 * @returns	{string|HTMLElement}
			 */
			get title() {
				return currentTitle;
			},

			/**
			 * Update the tab title.
			 *
			 * @param	{string|HTMLElement}	title
			 */
			set title(title) {
				if (isElement(title)) {
					emptyNode(tab.label);
					tab.label.appendChild(title);
				} else {
					tab.label.innerText = title;
				}

				currentTitle = title;
			},

			set disabled(isDisabled) {
				setDisabled(isDisabled);
			},

			get disabled() {
				return disabled;
			}
		};

		instance.title = title;
		this.tabs[id] = instance;
		this.container.tabs.appendChild(tab);

		if (!this.activated) {
			this.defaultTab = instance;
			activate(false);
		}

		return this;
	}

	/**
	 * Remove a tab
	 *
	 * @param		{string}		id
	 * @returns		{this}
	 */
	remove(id) {
		if (!this.tabs[id])
			return this;

		const instance = this.tabs[id];

		if (instance.activated) {
			const ids = Object.keys(this.tabs);
			const position = ids.indexOf(id);

			if (position > 0) {
				const prevId = ids[position - 1];
				this.tabs[prevId].activate();
			} else {
				instance.deactivate();
			}
		}

		delete this.tabs[id];
		this.container.tabs.removeChild(instance.tab);

		if (!this.activated) {
			const ids = Object.keys(this.tabs);

			if (ids.length > 0) {
				// If after tab removal, no tabs were activated, we will activate
				// the first tab if available.
				this.tabs[ids[0]].activate();
			}
		}

		return this;
	}

	/**
	 * Activate tab by tab ID.
	 *
	 * @param   {string}    id
	 * @param   {object}    options
	 * @param   {boolean}   options.trusted
	 * @returns {this}
	 */
	activate(id, { trusted = false }) {
		if (!this.tabs[id])
			return this;

		this.tabs[id].activate(trusted);
		return this;
	}

	/**
	 * Mark a tab as disabled/enabed.
	 *
	 * @param	{string}	id
	 * @param	{boolean}	disabled
	 * @returns {this}
	 */
	disabled(id, disabled = true) {
		if (!this.tabs[id])
			return this;

		this.tabs[id].disabled = disabled;
		return this;
	}
}

/**
 * Screen instance picker
 *
 * @template	{object|Model}		T
 */
class ScreenInstancePicker {
	/**
	 * @typedef {{
	 *	label: string|HTMLElement
	 * 	value: string|number
	 * 	view: HTMLElement
	 * 	instance: T
	 * 	activated: boolean
	 * 	selected: boolean
	 * }} PickerItemInstance
	 */

	/**
	 * Create a new instance picker
	 *
	 * @param	{object}	options
	 */
	constructor() {
		this.addButton = createButton(app.string("add"), {
			icon: "left",
			color: "green",
			onClick: () => this.addAvailable({ trusted: true }),
			afterClicked: () => this.updateState()
		});

		this.addAllButton = createButton(app.string("addAll"), {
			icon: "leftFromLine",
			color: "green",
			onClick: () => this.addAllAvailable({ trusted: true }),
			afterClicked: () => this.updateState()
		});

		this.removeButton = createButton(app.string("remove"), {
			icon: "right",
			color: "blue",
			align: "right",
			onClick: () => this.removeSelected({ trusted: true }),
			afterClicked: () => this.updateState()
		});

		this.removeAllButton = createButton(app.string("removeAll"), {
			icon: "rightFromLine",
			color: "blue",
			align: "right",
			onClick: () => this.removeAllSelected({ trusted: true }),
			afterClicked: () => this.updateState()
		});

		this.deactivateAllButton = createButton(app.string("deselectAll"), {
			color: "brown",
			onClick: () => this.deactivateAll(),
			afterClicked: () => this.updateState()
		});

		this.container = makeTree("div", "screen-instance-picker", {
			selected: { tag: "div", class: ["panel", "selected"], child: {
				label: { tag: "label", text: app.string("selected") },
				list: { tag: "div", class: "list", child: {
					inner: { tag: "div", class: "inner" }
				}}
			}},

			actions: { tag: "div", class: "actions", child: {
				addGroup: { tag: "div", class: "button-group", child: {
					addButton: this.addButton,
					addAllButton: this.addAllButton
				}},

				removeGroup: { tag: "div", class: "button-group", child: {
					removeButton: this.removeButton,
					removeAllButton: this.removeAllButton
				}},

				otherGroup: { tag: "div", class: "button-group", child: {
					deactivateAllButton: this.deactivateAllButton
				}}
			}},

			available: { tag: "div", class: ["panel", "available"], child: {
				label: { tag: "label", text: app.string("available") },
				input: { tag: "input", type: "search", class: "search-input", placeholder: app.string("type_to_search") },
				list: { tag: "div", class: "list", child: {
					inner: { tag: "div", class: "inner" }
				}}
			}}
		});

		this.loadingOverlay = new LoadingOverlay(this.container.available, {
			spinner: "simpleSpinner",
			index: 1
		});

		this.selectedScroll = new Scrollable(this.container.selected.list, {
			content: this.container.selected.list.inner
		});

		this.availableScroll = new Scrollable(this.container.available.list, {
			content: this.container.available.list.inner
		});

		this.emptyMessage = makeTree("div", "message", {
			icon: { tag: "icon", icon: "search" },
			label: { tag: "label", text: app.string("no_result_title") },
			sub: { tag: "div", text: app.string("no_result_sub") }
		});

		this.errorMessage = makeTree("div", "message", {
			icon: { tag: "icon", icon: "exclamation" },
			label: { tag: "label", text: "Unknown Error" },
			sub: { tag: "div", text: "An unknown error occured! Please try again later." },
			report: ScreenUtils.renderLink(app.string("response.errorReport"), "#", { newTab: true })
		});

		let searchTimeout = null;
		this.container.available.input.addEventListener("input", () => {
			clearTimeout(searchTimeout);
			searchTimeout = setTimeout(() => {
				this.search = this.container.available.input.value;
				this.update();
			}, 500);
		});

		this.isDisabled = false;

		/** @type {string} */
		this.search = null;

		/**
		 * Item fetcher
		 *
		 * @param	{string}		search
		 * @param	{T[]}			selected
		 * @returns	{T[]}
		 */
		this.fetcher = null;

		/**
		 * Item processor
		 *
		 * @param	{T}														value
		 * @returns	{{ label: string|HTMLElement, value: string|number }}
		 */
		this.processor = (value) => ({ label: value, value });

		/** @type {{[value: string]: PickerItemInstance}} */
		this.instances = {};

		/** @type {PickerItemInstance[]} */
		this.current = [];

		/** @type {PickerItemInstance[]} */
		this.available = [];

		/** @type {PickerItemInstance[]} */
		this.availableActivated = [];

		/** @type {PickerItemInstance[]} */
		this.selected = [];

		/** @type {PickerItemInstance[]} */
		this.selectedActivated = [];

		/** @type {((selected: PickerItemInstance[], picker: ScreenInstancePicker<T>) => void)[]} */
		this.selectHandlers = [];

		this.onSelected(() => this.update());
		this.updateState();
	}

	set loading(loading) {
		this.loadingOverlay.loading = loading;
	}

	/**
	 * Set item fetcher.
	 *
	 * @param	{(search: string, selected: T[]) => T[]}		fetcher
	 */
	setFetcher(fetcher) {
		if (typeof fetcher !== "function")
			throw new Error(`ScreenInstancePicker().setFetcher(): fetcher is not a valid function`);

		this.fetcher = fetcher;
	}

	/**
	 * Set item processor.
	 *
	 * @param	{(value: T) => { label: string|HTMLElement, value: string|number }}		processor
	 */
	setProcessor(processor) {
		if (typeof processor !== "function")
			throw new Error(`ScreenInstancePicker().setProcessor(): processor is not a valid function`);

		this.processor = processor;
	}

	/**
	 * Set item selected handler.
	 *
	 * @param	{(selected: PickerItemInstance[], picker: ScreenInstancePicker<T>, options: { trusted: boolean }) => void}		handler
	 */
	onSelected(handler) {
		if (typeof handler !== "function")
			throw new Error(`ScreenInstancePicker().setProcessor(): processor is not a valid function`);

		this.selectHandlers.push(handler);
		return this;
	}

	/**
	 * Set items list available to use in the instance selector.
	 *
	 * @param	{T[]}		items
	 * @param	{boolean}	selected	Is these items selected?
	 * @returns	{this}
	 */
	setItems(items, selected = false) {
		if (!items || items.length == 0) {
			this.current = [];
			this.updateItems();
			this.container.available.list.inner.appendChild(this.emptyMessage);
			return this;
		}

		this.current = [];

		for (const item of items) {
			const info = this.processor(item);

			if (this.instances[info.value]) {
				const instance = this.instances[info.value];

				instance.label = info.label;

				if (!instance.selected) {
					this.current.push(instance);

					if (selected)
						instance.selected = true;
				}

				continue;
			}

			const view = document.createElement("div");
			view.classList.add("instance-item");

			let isActivated = false;
			let isSelected = false;

			const setLabel = (label) => {
				if (isElement(label)) {
					emptyNode(view);
					view.appendChild(label);
					view.classList.add("node");
				} else {
					view.innerHTML = label;
					view.classList.remove("node");
				}

				info.label = label;
			};

			const setSelected = (selected) => {
				if (isSelected === selected)
					return;

				if (selected) {
					this.container.selected.list.inner.appendChild(view);

					if (this.available.includes(instance))
						this.available.splice(this.available.indexOf(instance), 1);

					if (this.availableActivated.includes(instance))
						this.availableActivated.splice(this.availableActivated.indexOf(instance), 1);

					if (!this.selected.includes(instance))
						this.selected.push(instance);

					if (!this.selectedActivated.includes(instance) && isActivated)
						this.selectedActivated.push(instance);
				} else {
					this.container.available.list.inner.appendChild(view);

					if (this.selected.includes(instance))
						this.selected.splice(this.selected.indexOf(instance), 1);

					if (this.selectedActivated.includes(instance))
						this.selectedActivated.splice(this.selectedActivated.indexOf(instance), 1);

					if (!this.available.includes(instance))
						this.available.push(instance);

					if (!this.availableActivated.includes(instance) && isActivated)
						this.availableActivated.push(instance);
				}

				isSelected = selected;
			};

			const activate = (activated = true) => {
				if (isActivated == activated)
					return;

				if (activated) {
					if (isSelected) {
						if (!this.selectedActivated.includes(instance))
							this.selectedActivated.push(instance);
					} else {
						if (!this.availableActivated.includes(instance))
							this.availableActivated.push(instance);
					}

					view.classList.add("activated");
				} else {
					if (isSelected) {
						if (this.selectedActivated.includes(instance))
							this.selectedActivated.splice(this.selectedActivated.indexOf(instance), 1);
					} else {
						if (this.availableActivated.includes(instance))
							this.availableActivated.splice(this.availableActivated.indexOf(instance), 1);
					}

					view.classList.remove("activated");
				}

				isActivated = activated;
				this.updateState();
			};

			view.addEventListener("click", () => activate(!isActivated));

			/** @type {PickerItemInstance} */
			const instance = {
				instance: item,
				view,

				get label() {
					return info.label;
				},

				set label(label) {
					setLabel(label);
				},

				get value() {
					return info.value;
				},

				get activated() {
					return isActivated;
				},

				set activated(activated) {
					activate(activated);
				},

				set selected(selected) {
					setSelected(selected);
				},

				get selected() {
					return isSelected;
				}
			};

			setLabel(info.label);
			this.instances[instance.value] = instance;
			this.current.push(instance);

			if (selected)
				instance.selected = true;
		}

		this.updateItems();
		return this;
	}

	updateItems() {
		emptyNode(this.container.selected.list.inner);
		emptyNode(this.container.available.list.inner);
		this.available = [];

		for (const current of this.current) {
			if (!this.selected.includes(current) && !this.available.includes(current))
				this.available.push(current);
		}

		for (const { view } of this.available)
			this.container.available.list.inner.appendChild(view);

		for (const { view } of this.selected)
			this.container.selected.list.inner.appendChild(view);

		this.updateState();
		return this;
	}

	updateState() {
		this.addAllButton.disabled = this.isDisabled || (this.available.length <= 0);
		this.removeAllButton.disabled = this.isDisabled || (this.selected.length <= 0);

		this.addButton.disabled = this.isDisabled || (this.availableActivated.length <= 0);
		this.removeButton.disabled = this.isDisabled || (this.selectedActivated.length <= 0);

		this.deactivateAllButton.disabled = this.isDisabled || (this.availableActivated.length <= 0 && this.selectedActivated.length <= 0);

		this.availableScroll.updateState();
		this.availableScroll.updateScrollbarPos();
		this.availableScroll.updateScrollbar();

		this.selectedScroll.updateState();
		this.selectedScroll.updateScrollbarPos();
		this.selectedScroll.updateScrollbar();
		return this;
	}

	addAvailable({ trusted = false } = {}) {
		if (this.isDisabled)
			return this;

		for (const item of [...this.availableActivated])
			item.selected = true;

		this.updateState();
		this.triggerSelectedHandlers({ trusted });
		return this;
	}

	addAllAvailable({ trusted = false } = {}) {
		if (this.isDisabled)
			return this;

		for (const item of [...this.available])
			item.selected = true;

		this.updateState();
		this.triggerSelectedHandlers({ trusted });
		return this;
	}

	removeSelected({ trusted = false } = {}) {
		if (this.isDisabled)
			return this;

		for (const item of [...this.selectedActivated])
			item.selected = false;

		this.updateState();
		this.triggerSelectedHandlers({ trusted });
		return this;
	}

	removeAllSelected({ trusted = false } = {}) {
		if (this.isDisabled)
			return this;

		for (const item of [...this.selected])
			item.selected = false;

		this.updateState();
		this.triggerSelectedHandlers({ trusted });
		return this;
	}

	async triggerSelectedHandlers({ trusted = false } = {}) {
		for (const handler of this.selectHandlers) {
			try {
				await handler(this.selected, this, { trusted });
			} catch (e) {
				clog("WARN", `ScreenInstancePicker(): an error occured while handling selected handler`, e);
			}
		}
	}

	deactivateAll() {
		if (this.isDisabled)
			return this;

		for (const item of [...this.availableActivated])
			item.activated = true;

		for (const item of [...this.selectedActivated])
			item.activated = false;

		this.updateState();
		return this;
	}

	reset() {
		this.deactivateAll();
		this.removeAllSelected();

		this.selected = [];
		this.selectedActivated = [];
		this.available = [];
		this.availableActivated = [];
		emptyNode(this.container.selected.list.inner);
		emptyNode(this.container.available.list.inner);
		this.updateState();
		return this;
	}

	async update() {
		if (!this.fetcher || this.isDisabled)
			return;

		this.loading = true;

		try {
			const instances = await this.fetcher(this.search, this.value);
			this.setItems(instances);
		} catch (e) {
			clog("WARN", `ScreenInstancePicker().update(): handing fetch resulted in an error:`, e);

			const { code, description } = parseException(e);
			this.errorMessage.label.innerText = code;
			this.errorMessage.sub.innerHTML = description;

			if (e.data && e.data.report) {
				this.errorMessage.report.style.display = null;
				this.errorMessage.report.href = e.data.report;
			} else {
				this.errorMessage.report.style.display = "none";
			}

			emptyNode(this.container.available.list.inner);
			this.container.available.list.inner.appendChild(this.errorMessage);
		}

		this.loading = false;
	}

	/**
	 * Set items list available to use in the instance selector.
	 *
	 * @param	{T}		items
	 */
	set items(items) {
		this.setItems(items);
	}

	/**
	 * Return selected instances.
	 *
	 * @returns	{T[]}
	 */
	get value() {
		return this.selected.map((item) => item.instance);
	}

	/**
	 * Set selected instances.
	 *
	 * @param	{T[]}	value
	 */
	set value(value) {
		this.setItems(value, true);
	}

	get disabled() {
		return this.isDisabled;
	}

	set disabled(disabled) {
		this.isDisabled = disabled;
		this.container.classList.toggle("disabled", disabled);
		this.updateState();
	}
}
