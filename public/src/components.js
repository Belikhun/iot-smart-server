
class GaugeComponent {
	/**
	 * Initialize a gauge.
	 *
	 * @param	{object}				options
	 * @param	{number}				options.duration
	 * @param	{(number) => number}	options.timing
	 * @param	{number}				options.width
	 * @param	{number}				options.height
	 * @param	{number}				options.startAngle
	 * @param	{number}				options.endAngle
	 * @param	{number}				options.ticks
	 */
	constructor({
		duration = 1,
		timing = Easing.OutCubic,
		colorFrom = app.color("accent"),
		colorTo = app.color("accent"),
		width = 400,
		height = 300,
		startAngle = -205,
		endAngle = 25,
		ticks = 12
	} = {}) {
		this.id = randString(8);
		this.initialized = false;
		this.container = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		this.container.classList.add("gauge-component");
		this.container.setAttribute("width", width);
		this.container.setAttribute("height", height);
		this.container.setAttribute("viewBox", `0 0 ${width} ${height}`);

		this.width = width;
		this.height = height;
		this.startAngle = startAngle;
		this.endAngle = endAngle;
		this.ticks = ticks;
		this.currentValue = 0;
		this.currentEndAngle = startAngle;
		this.duration = duration;
		this.timing = timing;
		this.colorFrom = colorFrom;
		this.colorTo = colorTo;

		this.centerX = this.width / 2;
		this.centerY = (this.height / 2) + 32;
		this.radius = Math.min(this.width, this.height) / 2;

		this.svgTicks = document.createElementNS("http://www.w3.org/2000/svg", "g");
		this.svgTicks.classList.add("ticks");

		this.svgBackground = document.createElementNS("http://www.w3.org/2000/svg", "path");
		this.svgBackground.classList.add("background");

		this.svgValue = document.createElementNS("http://www.w3.org/2000/svg", "path");
		this.svgValue.classList.add("value");
		this.svgValue.setAttribute("stroke", `url(#gaugeGradient_${this.id})`);

		/** @type {Animator} */
		this.valueAnimator = null;

		this.svgHand = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
		this.svgHand.classList.add("hand");
		this.svgHand.style.transitionDuration = `${this.duration}s`;
		this.svgHand.setAttribute("fill", `url(#handGradient_${this.id})`);
		this.svgHand.setAttribute("points", `${this.centerX},${this.centerY - 12} ${this.centerX + this.radius - 46},${this.centerY} ${this.centerX},${this.centerY + 12}`);
		this.svgHand.setAttribute("transform-origin", `${this.centerX} ${this.centerY}`);

		this.svgCenter = document.createElementNS("http://www.w3.org/2000/svg", "circle");
		this.svgCenter.classList.add("center");
		this.svgCenter.setAttribute("r", 16);
		this.svgCenter.setAttribute("stroke", `url(#centerGradient_${this.id})`);

		this.container.append(this.svgTicks, this.svgBackground, this.svgValue, this.svgHand, this.svgCenter);

		this.defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
		this.container.prepend(this.defs);

		this.createGradients();
		this.drawTicks();
		this.drawBackground();
		this.drawCenter();

		this.value = 0;
		this.initialized = true;
	}

	createGradients() {
		// Create gauge gradient
		const gaugeGradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
		gaugeGradient.id = `gaugeGradient_${this.id}`;
		gaugeGradient.setAttribute("gradientUnits", "userSpaceOnUse");
		gaugeGradient.setAttribute("x1", "0%");
		gaugeGradient.setAttribute("y1", "0%");
		gaugeGradient.setAttribute("x2", "100%");
		gaugeGradient.setAttribute("y2", "0%");

		const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
		stop1.setAttribute("offset", "0%");
		stop1.setAttribute("stop-color", this.colorFrom);
		stop1.setAttribute("stop-opacity", "1");

		const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
		stop2.setAttribute("offset", "100%");
		stop2.setAttribute("stop-color", this.colorTo);
		stop2.setAttribute("stop-opacity", "1");

		gaugeGradient.appendChild(stop1);
		gaugeGradient.appendChild(stop2);
		this.defs.appendChild(gaugeGradient);

		// Create hand gradient
		const handGradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
		handGradient.id = `handGradient_${this.id}`;
		handGradient.setAttribute("x1", "0%");
		handGradient.setAttribute("y1", "50%");
		handGradient.setAttribute("x2", "100%");
		handGradient.setAttribute("y2", "50%");

		const handStop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
		handStop1.setAttribute("offset", "30%");
		handStop1.setAttribute("stop-color", "#FCFCFC");
		handStop1.setAttribute("stop-opacity", "0");

		const handStop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
		handStop2.setAttribute("offset", "100%");
		handStop2.setAttribute("stop-color", "#23223E");
		handStop2.setAttribute("stop-opacity", "0.8");

		handGradient.appendChild(handStop1);
		handGradient.appendChild(handStop2);
		this.defs.appendChild(handGradient);

		// Create center gradient
		const centerGradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
		centerGradient.id = `centerGradient_${this.id}`;
		centerGradient.setAttribute("x1", "0%");
		centerGradient.setAttribute("y1", "0%");
		centerGradient.setAttribute("x2", "100%");
		centerGradient.setAttribute("y2", "100%");

		const centerStop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
		centerStop1.setAttribute("offset", "0%");
		centerStop1.setAttribute("stop-color", this.colorFrom);
		centerStop1.setAttribute("stop-opacity", "1");

		const centerStop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
		centerStop2.setAttribute("offset", "100%");
		centerStop2.setAttribute("stop-color", this.colorTo);
		centerStop2.setAttribute("stop-opacity", "1");

		centerGradient.appendChild(centerStop1);
		centerGradient.appendChild(centerStop2);
		this.defs.appendChild(centerGradient);
	}

	drawTicks() {
		for (let i = 0; i <= this.ticks; i++) {
			const angle = this.startAngle + (i / this.ticks) * (this.endAngle - this.startAngle);
			const radian = angle * (Math.PI / 180);
			const x1 = this.centerX + (this.radius - 36) * Math.cos(radian);
			const y1 = this.centerY + (this.radius - 36) * Math.sin(radian);
			const x2 = this.centerX + (this.radius - 20) * Math.cos(radian);
			const y2 = this.centerY + (this.radius - 20) * Math.sin(radian);

			const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
			tick.setAttribute("x1", x1);
			tick.setAttribute("y1", y1);
			tick.setAttribute("x2", x2);
			tick.setAttribute("y2", y2);
			tick.classList.add("tick");
			this.svgTicks.appendChild(tick);
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

	drawCenter() {
		this.svgCenter.setAttribute("cx", this.centerX);
		this.svgCenter.setAttribute("cy", this.centerY);
	}

	set value(value) {
		value = Math.min(1, Math.max(0, value));

		if (value === this.currentValue && this.initialized)
			return;

		this.currentValue = value;

		const angle = this.startAngle + (value * (this.endAngle - this.startAngle));

		const startAngle = this.startAngle * (Math.PI / 180);
		const startX = this.centerX + this.radius * Math.cos(startAngle);
		const startY = this.centerY + this.radius * Math.sin(startAngle);

		if (!this.initialized) {
			const pathData = [
				`M ${startX} ${startY}`,
				`A ${this.radius} ${this.radius} 0 0 1 ${startX} ${startY}`
			].join(" ");

			this.currentEndAngle = startAngle;
			this.svgValue.setAttribute("d", pathData);
		} else {
			const endAngle = angle * (Math.PI / 180);
			const endAngleAnimStart = this.currentEndAngle;

			if (this.valueAnimator)
				this.valueAnimator.cancel();

			this.valueAnimator = new Animator(this.duration, this.timing, (t) => {
				this.currentEndAngle = endAngleAnimStart + ((endAngle - endAngleAnimStart) * t);

				const endX = this.centerX + this.radius * Math.cos(this.currentEndAngle);
				const endY = this.centerY + this.radius * Math.sin(this.currentEndAngle);
				const largeArcFlag = (this.currentEndAngle - startAngle <= Math.PI) ? "0" : "1";

				const pathData = [
					`M ${startX} ${startY}`,
					`A ${this.radius} ${this.radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
				].join(" ");

				this.svgValue.setAttribute("d", pathData);
			});
		}

		// Set the rotation transformation for the hand
		this.svgHand.style.setProperty("--rotation", `${angle}deg`);
		this.svgHand.classList[value === 1 ? "add" : "remove"]("shaking");
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
		}

		this.container.addEventListener("mousedown", (e) => {
			mouseDownPoint = [e.clientX, e.clientY];
			mouseDownValue = this.value;
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
