
class GaugeComponent {
	constructor({
		width = 160,
		startAngle = -205,
		endAngle = 25,
		arcWidth = 8,
		shift = 22,
		minValue = 0,
		maxValue = 100,
		dangerousValue = null,
		square = false,
		labelDistBottom = 0,
		labelDistEdge = "1.5rem",
		unit = null
	} = {}) {
		this.id = randString(8);
		this.initialized = false;

		this.gauge = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		this.gauge.classList.add("gauge-arc");
		this.gauge.style.setProperty("--arc-width", `${arcWidth}px`);

		this.svgBackground = document.createElementNS("http://www.w3.org/2000/svg", "path");
		this.svgBackground.classList.add("background");

		this.svgValue = document.createElementNS("http://www.w3.org/2000/svg", "path");
		this.svgValue.classList.add("value");

		this.gauge.append(this.svgBackground, this.svgValue);

		this.container = makeTree("div", "gauge-component", {
			gauge: this.gauge,
			value: { tag: "div", class: "value", child: {
				current: { tag: "div", class: "current", text: "---" },
				unit: { tag: "div", class: "unit", text: unit }
			}},

			min: { tag: "span", class: "min-value", text: minValue },
			max: { tag: "span", class: "max-value", text: maxValue },
			hand: { tag: "div", class: "hand" }
		});

		this.width = width;
		this.startAngle = startAngle;
		this.endAngle = endAngle;
		this.currentValue = 0;
		this.minValue = minValue;
		this.maxValue = maxValue;
		this.dangerousValue = dangerousValue;

		if (typeof labelDistBottom === "number")
			labelDistBottom += "px";

		if (typeof labelDistEdge === "number")
			labelDistEdge += "px";

		this.container.style.setProperty("--label-dist-bottom", labelDistBottom);
		this.container.style.setProperty("--label-dist-edge", labelDistEdge);
		this.container.style.setProperty("--arc-width", `${arcWidth}px`);

		if (square) {
			this.height = this.width;
			this.centerX = this.width / 2;
			this.centerY = this.height / 2;
			this.radius = (this.width - arcWidth) / 2;
		} else {
			const theta = Math.abs(this.endAngle - this.startAngle);
			const radius = (this.width + arcWidth) / (2 * Math.sin(theta / 2));
			this.height = radius * (1 - Math.cos(theta / 2));
	
			this.centerX = this.width / 2;
			this.centerY = (this.height / 2) + shift;
			this.radius = (this.width - arcWidth) / 2;
		}

		this.gauge.setAttribute("width", this.width);
		this.gauge.setAttribute("height", this.height);
		this.gauge.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
		this.container.style.setProperty("--center-x", `${this.centerX}px`);
		this.container.style.setProperty("--center-y", `${this.centerY}px`);
		this.container.style.setProperty("--radius", `${this.radius}px`);

		this.drawBackground();

		if (this.dangerousValue)
			this.drawDangerousZone();

		this.value = 0;
		this.initialized = true;
	}

	set unit(/** @type {string} */ unit) {
		if (unit) {
			this.container.value.unit.innerText = unit;
			this.container.value.unit.style.display = null;
		} else {
			this.container.value.unit.style.display = "none";
		}
	}

	drawBackground() {
		const startAngle = this.startAngle * (Math.PI / 180);
		const endAngle = this.endAngle * (Math.PI / 180);

		const startX = this.centerX + this.radius * Math.cos(startAngle);
		const startY = this.centerY + this.radius * Math.sin(startAngle);
		const endX = this.centerX + this.radius * Math.cos(endAngle);
		const endY = this.centerY + this.radius * Math.sin(endAngle);

		const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";

		const pathData = [
			`M ${startX} ${startY}`,
			`A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
		].join(" ");

		this.svgBackground.setAttribute("d", pathData);
	}

	drawDangerousZone() {
		if (!this.dangerZone) {
			this.dangerZone = document.createElementNS("http://www.w3.org/2000/svg", "path");
			this.dangerZone.classList.add("dangerous");
		}

		if (!this.dangerousValue) {
			if (this.gauge.contains(this.dangerZone))
				this.gauge.removeChild(this.dangerZone);

			return;
		}

		const startP = scaleValue(this.dangerousValue, [this.minValue, this.maxValue], [0, 1]);
		const startAngle = (this.startAngle + (startP * (this.endAngle - this.startAngle))) * (Math.PI / 180);
		const startX = this.centerX + this.radius * Math.cos(startAngle);
		const startY = this.centerY + this.radius * Math.sin(startAngle);
		
		const endAngle = this.endAngle * (Math.PI / 180);
		const endX = this.centerX + this.radius * Math.cos(endAngle);
		const endY = this.centerY + this.radius * Math.sin(endAngle);

		const largeArcFlag = (endAngle - startAngle <= Math.PI) ? "0" : "1";

		const pathData = [
			`M ${startX} ${startY}`,
			`A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
		].join(" ");

		this.dangerZone.setAttribute("d", pathData);
		this.gauge.insertBefore(this.dangerZone, this.svgValue);
	}

	/**
	 * Set value
	 * 
	 * @param	{number}	value
	 */
	setValue(value) {
		if (value === this.currentValue && this.initialized)
			return this;

		this.currentValue = value;
		this.container.value.current.innerText = this.currentValue;
		this.container.classList.toggle("dangerous", this.currentValue >= this.dangerousValue);
		const progress = scaleValue(this.currentValue, [this.minValue, this.maxValue], [0, 1]);

		const startAngle = this.startAngle * (Math.PI / 180);
		const startX = this.centerX + this.radius * Math.cos(startAngle);
		const startY = this.centerY + this.radius * Math.sin(startAngle);

		const angle = this.startAngle + (progress * (this.endAngle - this.startAngle));
		const endAngle = angle * (Math.PI / 180);
		const endX = this.centerX + this.radius * Math.cos(endAngle);
		const endY = this.centerY + this.radius * Math.sin(endAngle);

		const largeArcFlag = (endAngle - startAngle <= Math.PI) ? "0" : "1";

		const pathData = [
			`M ${startX} ${startY}`,
			`A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
		].join(" ");

		this.svgValue.setAttribute("d", pathData);
		this.container.hand.style.setProperty("--rotation", `${angle + 90}deg`);
		return this;
	}

	set value(value) {
		this.setValue(value);
	}

	get value() {
		return this.currentValue;
	}
}

class KnobComponent {
	constructor({
		width = 160,
		startAngle = -205,
		endAngle = 25,
		arcWidth = 8,
		shift = 22,
		knobSpacing = 32,
		dragDistance = 400
	} = {}) {
		this.id = randString(8);
		this.initialized = false;

		this.gauge = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		this.gauge.classList.add("knob-arc");
		this.gauge.style.setProperty("--arc-width", `${arcWidth}px`);

		this.svgBackground = document.createElementNS("http://www.w3.org/2000/svg", "path");
		this.svgBackground.classList.add("background");

		this.svgValue = document.createElementNS("http://www.w3.org/2000/svg", "path");
		this.svgValue.classList.add("value");

		this.gauge.append(this.svgBackground, this.svgValue);

		this.thumb = document.createElement("div");
		this.thumb.classList.add("thumb");
		this.thumb.style.width = this.thumb.style.height = `${width - arcWidth - knobSpacing}px`;

		this.valueNode = document.createElement("div");
		this.valueNode.classList.add("value");

		this.container = makeTree("div", "rotate-knob-component", {
			gauge: this.gauge,
			thumb: this.thumb,
			value: this.valueNode
		});

		this.width = width;
		this.startAngle = startAngle;
		this.endAngle = endAngle;
		this.currentValue = 0;
		this.inputHandlers = [];

		const theta = Math.abs(this.endAngle - this.startAngle);
		const radius = (this.width + arcWidth) / (2 * Math.sin(theta / 2));
		this.height = radius * (1 - Math.cos(theta / 2));

		this.centerX = this.width / 2;
		this.centerY = (this.height / 2) + shift;
		this.radius = (this.width - arcWidth) / 2;

		// this.height = this.width;
		// this.centerX = this.width / 2;
		// this.centerY = this.height / 2;
		// this.radius = (this.width - arcWidth) / 2;

		this.gauge.setAttribute("width", this.width);
		this.gauge.setAttribute("height", this.height);
		this.gauge.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
		this.container.style.setProperty("--center-x", `${this.centerX}px`);
		this.container.style.setProperty("--center-y", `${this.centerY}px`);

		this.container.addEventListener("wheel", (e) => {
			e.preventDefault();
			e.stopImmediatePropagation();
			e.stopPropagation();

			this.setValue(this.value - (e.deltaY / 10000), "user");
		});

		let mouseDownPoint = null;
		let mouseDownValue = null;

		const handleMouseMove = (/** @type {MouseEvent} */ e) => {
			const distance = mouseDownPoint[1] - e.clientY;
			const newValue = round(Math.max(0, Math.min(1, mouseDownValue + (distance / dragDistance))), 2);
			this.setValue(newValue, "user");
		};

		const handleMouseUp = (/** @type {MouseEvent} */ e) => {
			app.root.removeEventListener("mousemove", handleMouseMove);
			app.root.removeEventListener("mouseup", handleMouseUp);
			this.container.classList.remove("dragging");
		}

		this.container.addEventListener("mousedown", (e) => {
			mouseDownPoint = [e.clientX, e.clientY];
			mouseDownValue = this.value;
			this.container.classList.add("dragging");
			app.root.addEventListener("mousemove", handleMouseMove);
			app.root.addEventListener("mouseup", handleMouseUp, { once: true });
		});

		this.drawBackground();

		this.value = 0;
		this.initialized = true;
	}

	drawBackground() {
		const startAngle = this.startAngle * (Math.PI / 180);
		const endAngle = this.endAngle * (Math.PI / 180);

		const startX = this.centerX + this.radius * Math.cos(startAngle);
		const startY = this.centerY + this.radius * Math.sin(startAngle);
		const endX = this.centerX + this.radius * Math.cos(endAngle);
		const endY = this.centerY + this.radius * Math.sin(endAngle);

		const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";

		const pathData = [
			`M ${startX} ${startY}`,
			`A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
		].join(" ");

		this.svgBackground.setAttribute("d", pathData);
	}

	/**
	 * Set value
	 * 
	 * @param	{number}				value
	 * @param	{"user" | "internal"}	source
	 */
	setValue(value, source = "internal") {
		value = Math.min(1, Math.max(0, value));

		if (value === this.currentValue && this.initialized)
			return this;

		this.currentValue = value;
		this.valueNode.innerText = `${Math.floor(value * 100)}%`;

		const startAngle = this.startAngle * (Math.PI / 180);
		const startX = this.centerX + this.radius * Math.cos(startAngle);
		const startY = this.centerY + this.radius * Math.sin(startAngle);

		const angle = this.startAngle + (value * (this.endAngle - this.startAngle));
		const endAngle = angle * (Math.PI / 180);
		const endX = this.centerX + this.radius * Math.cos(endAngle);
		const endY = this.centerY + this.radius * Math.sin(endAngle);

		const largeArcFlag = (endAngle - startAngle <= Math.PI) ? "0" : "1";

		const pathData = [
			`M ${startX} ${startY}`,
			`A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
		].join(" ");

		this.svgValue.setAttribute("d", pathData);
		this.thumb.style.setProperty("--rotation", `${angle + 90}deg`);

		if (source === "user") {
			for (const handler of this.inputHandlers) {
				try {
					handler(this.value);
				} catch (e) {
					clog("WARN", `KnobComponent(): an error occured while handing input handler:`, e);
					continue;
				}
			}
		}

		return this;
	}

	/**
	 * Handle input value change.
	 * 
	 * @param	{(value: number) => void}	handler
	 */
	onInput(handler) {
		this.inputHandlers.push(handler);
		return this;
	}

	set value(value) {
		this.setValue(value, "internal");
	}

	get value() {
		return this.currentValue;
	}
}
