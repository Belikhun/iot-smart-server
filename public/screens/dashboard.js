
const dashboard = {
	/**
	 * @typedef {{
	 * 	model: DashboardItem
	 * 	renderer: DashboardBlockRenderer
	 * }} DashboardBlockInstance
	 */

	/** @type {ScreenChild} */
	screen: undefined,

	/** @type {TreeDOM} */
	view: undefined,

	/** @type {GridStack} */
	grid: undefined,

	gridState: null,
	
	/** @type {{ [type: string]: function }} */
	renderers: {},
	
	/** @type {SQButton} */
	updateButton: undefined,

	/** @type {SQButton} */
	createButton: undefined,

	/** @type {ContextMenu} */
	createMenu: undefined,

	/** @type {{ [id: number]: DashboardBlockInstance }} */
	blocks: {},

	fetched: false,

	async init() {
		this.createMenu = new ContextMenu();
		this.createMenu.onSelect((type) => this.createBlock(type));

		this.updateButton = createButton("", {
			icon: "reload",
			color: "blue",
			onClick: () => this.fetch()
		});

		this.createButton = createButton("Thêm khối", {
			icon: "plus",
			color: "accent",
			onClick: (e) => this.createMenu.openByMouseEvent(e)
		});

		this.view = makeTree("div", "device-dashboard", {
			grid: { tag: "div", class: "grid" }
		});

		this.screen = new ScreenChild(
			screens.system,
			"dashboard",
			app.string("system_dashboard"),
			{
				title: app.string("system_dashboard_title"),
				activated: true,
				noGrid: true
			}
		);

		this.screen.addAction(this.updateButton);
		this.screen.addAction(this.createButton);

		this.screen.onActivate(() => {
			if (this.grid)
				this.grid.destroy(false);

			this.grid = GridStack.init({
				column: "auto",
				draggable: {
					handle: ".header"
				}
			}, this.view.grid);

			this.grid.margin("1rem");

			// if (this.gridState)
			// 	this.grid.load(this.gridState);

			if (!this.fetched)
				this.fetch();
		});

		this.screen.onDeactivate(() => {
			this.gridState = this.grid.save();
		});

		this.screen.loading = true;
		this.screen.content = this.view;

		// Register renderers.
		this.registerRenderer(BlockTextRenderer);
		this.registerRenderer(BlockQuickSettingsRenderer);
		this.registerRenderer(BlockSensorRenderer);
		this.registerRenderer(BlockKnobRenderer);
		this.registerRenderer(BlockColorWheelRenderer);
		this.registerRenderer(BlockScenesRenderer);
	},

	/**
	 * Register renderer
	 * 
	 * @param	{function}		renderer
	 */
	registerRenderer(renderer) {
		this.renderers[renderer.ID] = renderer;
		this.createMenu.add({ id: renderer.ID, icon: renderer.ICON, text: app.string(`block.${renderer.ID}`) });
		return this;
	},

	/**
	 * Get renderer
	 * 
	 * @param	{DashboardItem}				model
	 * @returns	{DashboardBlockRenderer}
	 */
	getRenderer(model) {
		if (!this.renderers[model.type])
			return new DashboardBlockRenderer(model);

		return new this.renderers[model.type](model);
	},

	findEmptyPosition(width = 2, height = 1) {
		this.gridState = this.grid.save();
		const maxCols = this.grid.opts.column || 12;

		for (let y = 0; ; y++) {
			for (let x = 0; x <= maxCols - width; x++) {
				const overlaps = this.gridState.some(item => {
					return (
						x < item.x + item.w &&
						x + width > item.x &&
						y < item.y + item.h &&
						y + height > item.y
					);
				});

				if (!overlaps) {
					return { x, y };
				}
			}
		}
	},

	async createBlock(type) {
		const [width, height] = this.renderers[type].SIZE;
		const { x, y } = this.findEmptyPosition(width, height);
		
		const instance = new DashboardItem();
		instance.type = type;
		instance.width = width;
		instance.height = height;
		instance.xPos = x;
		instance.yPos = y;

		/** @type {DashboardBlockRenderer} */
		const renderer = new this.renderers[type](instance);
		
		renderer.create(() => {
			this.blocks[instance.id] = {
				model: instance,
				renderer
			};

			renderer.register(this.grid);
			renderer.render();
		});
	},

	async fetch() {
		if (!devices.initialFetched)
			await devices.update(false);

		this.screen.loading = true;
		this.updateButton.loading = true;

		try {
			const response = await myajax({
				url: app.api("/dashboard/list"),
				method: "GET"
			});

			const items = DashboardItem.processResponses(response.data);

			for (const item of items) {
				if (!this.blocks[item.id]) {
					const renderer = this.getRenderer(item);

					this.blocks[item.id] = {
						model: item,
						renderer
					};

					renderer.register(this.grid);
				}

				this.blocks[item.id].model = item;
				this.blocks[item.id].renderer.render();
			}

			this.fetched = true;
		} catch (e) {
			this.screen.handleError(e);
		}

		this.updateButton.loading = false;
		this.screen.loading = false;
	}
}

class DashboardBlockRenderer {
	static get ID() {
		return "default";
	}

	static get ICON() {
		return "block";
	}

	static get SIZE() {
		return [2, 2];
	}

	/**
	 * The dashboard block constructor.
	 * 
	 * @param	{DashboardItem}		model
	 */
	constructor(model) {
		this.id = `dashboard_block_${this.constructor.ID}_${randString(7)}`;

		this.model = model;

		/** @type {TreeDOM} */
		this.view = null;
		
		/** @type {GridItemHTMLElement} */
		this.gridItem = null;

		this.menu = new ContextMenu()
			.add({ id: "edit", text: "Chỉnh sửa", icon: "pencil" })
			.add({ id: "delete", text: "Xóa", icon: "trash", color: "red" });

		this.menu.onSelect(async (action) => {
			switch (action) {
				case "edit":
					this.edit();
					break;
			
				case "delete":
					await this.delete();
			}
		});

		this.defaultForm = {
			main: {
				name: app.string("form.group.main"),
				rows: [
					{
						name: {
							type: "text",
							label: app.string("table.name"),
							required: true
						}
					}
				]
			},

			specification: {
				name: app.string("form.group.specification"),
				rows: [
					{
						icon: {
							type: "autocomplete",
							label: app.string("table.icon"),
							required: true,

							options: {
								/** @type {AutocompleteInputFetch} */
								fetch: async (search) => {
									if (!search)
										return app.icons;

									return app.icons.filter((v) => v.includes(search));
								},

								/** @type {AutocompleteInputProcess} */
								process: (item) => {
									return {
										label: ScreenUtils.renderSpacedRow(
											ScreenUtils.renderIcon(item),
											item
										),
										value: item
									};
								}
							}
						},

						color: {
							type: "autocomplete",
							label: app.string("table.color"),
							required: true,

							options: {
								/** @type {AutocompleteInputFetch} */
								fetch: async (search) => {
									if (!search)
										return app.colors;

									return app.colors.filter((v) => v.includes(search));
								},

								/** @type {AutocompleteInputProcess} */
								process: (item) => {
									return {
										label: ScreenUtils.renderBadge(app.string(`color.${item}`), item),
										value: item
									};
								}
							}
						}
					}
				]
			}
		};

		/** @type {ScreenForm} */
		this.form = null;

		this.fixedContent = false;
	}

	render() {
		if (!this.view) {
			this.view = makeTree("div", ["map-color", "dashboard-block", `block-${this.model.type}`], {
				header: { tag: "div", class: "header", child: {
					blade: { tag: "span", class: "blade", child: {
						icon: ScreenUtils.renderIcon(this.model.icon),
						titl: { tag: "span", class: "title", text: this.model.name }
					}}
				}},

				content: { tag: "div", class: "content", child: {
					inner: { tag: "div", class: "inner" }
				}}
			});

			this.view.draggable = false;
			this.view.header.draggable = true;
			this.view.content.draggable = false;
			this.view.header.addEventListener("contextmenu", (e) => this.menu.openByMouseEvent(e));
			this.view.content.classList.toggle("fixed", this.fixedContent);

			if (this.fixedContent) {
				let contentWidth;
				let contentHeight;
	
				requestAnimationFrame(() => {
					contentWidth = this.view.content.inner.clientWidth + 32;
					contentHeight = this.view.content.inner.clientHeight + 32;

					(new ResizeObserver(async () => {
						const containerWidth = this.view.content.clientWidth;
						const containerHeight = this.view.content.clientHeight;

						if (!contentWidth || !contentHeight || contentWidth <= 32 || contentHeight <= 32) {
							this.view.content.inner.style.transform = null;

							await nextFrameAsync();
							contentWidth = this.view.content.inner.clientWidth + 32;
							contentHeight = this.view.content.inner.clientWidth + 32;
						}

						const scale =  Math.min(containerWidth / contentWidth, containerHeight / contentHeight);
						this.view.content.inner.style.transform = `scale(${scale})`;
					})).observe(this.view.content);
				});
			}
		}

		this.view.dataset.color = this.model.color;
		this.view.header.blade.titl.innerText = this.model.name;
		emptyNode(this.view.content.inner);

		const content = this.renderContent();
		if (isElement(content)) {
			this.view.content.inner.appendChild(content);
		} else {
			this.view.content.inner.innerHTML = content;
		}

		return this.view;
	}

	renderContent() {
		return `Chưa hỗ trợ render khối ${this.model.type}`;
	}

	create(onCreated = () => {}) {
		if (!this.form)
			this.form = new ScreenForm(this.defaultForm);

		const title = app.string("model_creating", { model: `Khối ${app.string(`block.${this.model.type}`)}` });

		dashboard.screen.showPanel({
			title,
			content: this.form.form
		});

		this.form.reset(true);
		this.form.title = title;

		setTimeout(() => {
			this.form.show = true;
		}, 200);

		this.form.onSubmit(async (values) => {
			this.model.name = values.name;
			this.model.icon = values.icon;
			this.model.color = values.color;

			this.beforeSave(values);

			try {
				await this.model.save();
				app.screen.active.alert("OKAY", `Đã tạo thành công khối ${this.model.name}`);
			} catch (e) {
				// 221 is FieldError
				if (e.data && e.data.code === 221) {
					this.form.setError(e.data.data.name, e.data.details);
					return;
				}

				app.screen.active.handleError(e);
			}

			this.form.show = false;
			dashboard.screen.hidePanel();

			if (this.model.id)
				onCreated();
		});
	}

	async edit() {
		if (!this.form)
			this.form = new ScreenForm(this.defaultForm);

		dashboard.screen.showPanel({
			title: app.string("model_editing", { model: "Khối", name: this.model.name }),
			content: this.form.form
		});

		this.form.defaults = {
			...this.model,
			...(await this.formDefaultValue())
		};

		this.form.reset();
		this.form.title = app.string("model_editing", { model: "Khối", name: this.model.name });

		setTimeout(() => {
			this.form.show = true;
		}, 200);

		this.form.onSubmit(async (values) => {
			this.model.name = values.name;
			this.model.icon = values.icon;
			this.model.color = values.color;

			this.beforeSave(values);

			try {
				await this.model.save();
				app.screen.active.alert("OKAY", `Đã cập nhật thông tin cho khối ${this.model.name}`);

				if (this.view)
					this.render();
			} catch (e) {
				// 221 is FieldError
				if (e.data && e.data.code === 221) {
					this.form.setError(e.data.data.name, e.data.details);
					return;
				}

				app.screen.active.handleError(e);
			}

			this.form.show = false;
			dashboard.screen.hidePanel();
		});
	}

	async delete() {
		delete dashboard.blocks[this.model.id];
		await this.model.delete();
		this.destroy();
	}

	/**
	 * Add additional default value for form.
	 */
	async formDefaultValue() {
		return {};
	}

	/**
	 * Handle before save. Update external model values here.
	 * 
	 * @param {{ [key: string]: any }} values 
	 */
	beforeSave(values) {

	}

	destroy() {
		this.grid.removeWidget(this.gridItem);
	}

	/**
	 * Register this block into a grid.
	 * 
	 * @param	{GridStack}		grid
	 * @returns	{this}
	 */
	register(grid) {
		const view = this.render();

		const gridView = document.createElement("div");
		gridView.classList.add("grid-stack-item-content", "dashboard-block-wrapper");
		gridView.appendChild(view);
		gridView.dataset.itemId = this.model.id;

		this.grid = grid;
		this.gridItem = grid.makeWidget(gridView, {
			x: this.model.xPos,
			y: this.model.yPos,
			w: this.model.width,
			h: this.model.height
		});

		grid.on("change", async (event, items) => {
			for (const item of items) {
				if (item.el.dataset.itemId != this.model.id && !gridView.isSameNode(item.el))
					continue;

				this.model.width = item.w;
				this.model.height = item.h;
				this.model.xPos = item.x;
				this.model.yPos = item.y;
				await this.model.save();
				clog("INFO", `Đã cập nhật vị trí và kích cỡ cho khối ${this.model.name}!`);
			}
		});
	}
}

class BlockTextRenderer extends DashboardBlockRenderer {
	static get ID() {
		return "text";
	}

	static get ICON() {
		return "textSize";
	}

	constructor(model) {
		super(model);

		this.form = new ScreenForm({
			...this.defaultForm,

			content: {
				name: "Nội dung",
				rows: [
					{
						content: {
							type: "textarea",
							label: "Nội dung hiển thị (Markdown)"
						}
					}
				]
			}
		});
	}

	async formDefaultValue() {
		return {
			content: this.model.data.content
		};
	}

	beforeSave(values) {
		this.model.data = {
			content: values.content
		};
	}

	renderContent() {
		const view = document.createElement("div");
		view.classList.add("block-text-content");
		view.innerHTML = (this.model.data.content)
			? marked.parse(this.model.data.content)
			: "Không có giá trị";

		return view;
	}
}

class BlockQuickSettingsRenderer extends DashboardBlockRenderer {
	static get ID() {
		return "quickSettings";
	}

	static get ICON() {
		return "sliders";
	}

	static get SIZE() {
		return [3, 3];
	}

	constructor(model) {
		super(model);

		this.form = new ScreenForm({
			...this.defaultForm,

			content: {
				name: "Cài đặt nhanh",
				rows: [
					{
						features: {
							type: "autocomplete",
							label: "Các tính năng",

							options: {
								...featureSearch(FEATURE_FLAG_WRITE),
								multiple: true
							}
						}
					}
				]
			}
		});

		this.switches = {};
	}

	async formDefaultValue() {
		return {
			features: this.getFeatures()
		};
	}

	/**
	 * Get configured features to display.
	 * 
	 * @returns	{DeviceFeature[]}
	 */
	getFeatures() {
		const featureIds = (this.model.data.features)
			? this.model.data.features
			: [];

		return featureIds
			.map((uuid) => devices.getDeviceFeature(uuid))
			.filter((feature) => !!feature);
	}

	beforeSave(values) {
		const features = values.features
			.map((feature) => feature.uuid);

		this.model.data = {
			features
		};
	}

	renderContent() {
		if (!this.blockView) {
			this.blockView = document.createElement("div");
			this.blockView.classList.add("block-quick-settings");
		}

		emptyNode(this.blockView);
		const features = this.getFeatures();

		for (const feature of features) {
			if (!this.switches[feature.uuid]) {
				const switchView = renderSmartSwitch(feature);
				this.switches[feature.uuid] = switchView;
				switchView.update();
				this.blockView.appendChild(switchView.view);
				continue;
			}

			const switchView = this.switches[feature.uuid];
			switchView.update();
			this.blockView.appendChild(switchView.view);
			continue;
		}

		return this.blockView;
	}

	destroy() {
		super.destroy();
		
		for (const { destroy } of Object.values(this.switches))
			destroy();

		this.switches = {};
	}
}

class BlockSensorRenderer extends DashboardBlockRenderer {
	static get ID() {
		return "sensor";
	}

	static get ICON() {
		return "sensor";
	}

	constructor(model) {
		super(model);

		this.form = new ScreenForm({
			...this.defaultForm,

			content: {
				name: "Cảm biến",
				rows: [
					{
						feature: {
							type: "autocomplete",
							label: "Cảm biến hiển thị",
							required: true,

							options: {
								...featureSearch(FEATURE_FLAG_READ, { includeKinds: ["FeatureSensorValue"] })
							}
						}
					}
				]
			}
		});

		this.fixedContent = true;
	}

	async formDefaultValue() {
		return {
			feature: this.getFeature()
		};
	}

	/**
	 * Get configured feature to display.
	 * 
	 * @returns	{?DeviceFeature}
	 */
	getFeature() {
		if (!this.model.data)
			return null;

		return devices.getDeviceFeature(this.model.data);
	}

	beforeSave(values) {
		this.model.data = values.feature.uuid;
	}

	renderContent() {
		const feature = this.getFeature();

		if (!feature)
			return "Yêu cầu chọn một cảm biến để hiển thị dữ liệu";

		if (!this.gauge) {
			this.gauge = new GaugeComponent({
				width: 232,
				arcWidth: 24,
				shift: 32,
				labelDistEdge: "2.5rem"
			});

			this.blockView = makeTree("div", "block-sensor-content", {
				gauge: this.gauge,
				label: { tag: "div", class: "label", text: "---" }
			});

			this.updateValue = (value, source, sourceId) => {
				if (sourceId === this.id)
					return;

				this.gauge.value = value;
			};
		}

		if (!this.currentFeature || this.currentFeature.uuid !== feature.uuid) {
			const { max, min, unit, dangerous } = feature.extras;

			this.gauge.minValue = min;
			this.gauge.maxValue = max;
			this.gauge.unit = unit;
			this.blockView.label.innerText = feature.name;

			if (this.gauge.dangerousValue !== dangerous) {
				this.gauge.dangerousValue = dangerous;
				this.gauge.drawDangerousZone();
			}

			if (this.currentFeature)
				this.currentFeature.removeValueUpdate(this.updateValue);

			feature.onValueUpdate(this.updateValue);
			this.currentFeature = feature;

			this.gauge.value = feature.getValue();
		}

		return this.blockView;
	}

	destroy() {
		super.destroy();
		this.currentFeature.removeValueUpdate(this.updateValue);
	}
}

class BlockKnobRenderer extends DashboardBlockRenderer {
	static get ID() {
		return "knob";
	}

	static get ICON() {
		return "joystick";
	}

	constructor(model) {
		super(model);

		this.form = new ScreenForm({
			...this.defaultForm,

			content: {
				name: "Núm vặn",
				rows: [
					{
						feature: {
							type: "autocomplete",
							label: "Tính năng",
							required: true,

							options: {
								...featureSearch(FEATURE_FLAG_READ | FEATURE_FLAG_WRITE, { includeKinds: ["FeatureKnob", "FeatureRGBLed", "FeatureFanMotor"] })
							}
						}
					},
					{
						switch: {
							type: "autocomplete",
							label: "Công tắc bật tắt",
							required: false,

							options: {
								...featureSearch(FEATURE_FLAG_READ | FEATURE_FLAG_WRITE, { includeKinds: ["FeatureOnOffToggle", "FeatureButton"] })
							}
						}
					}
				]
			}
		});

		this.fixedContent = true;
	}

	async formDefaultValue() {
		return {
			feature: this.getFeature(),
			switch: this.getSwitch()
		};
	}

	/**
	 * Get configured feature to display.
	 * 
	 * @returns	{?DeviceFeature}
	 */
	getFeature() {
		if (!this.model.data || !this.model.data.feature)
			return null;

		return devices.getDeviceFeature(this.model.data.feature);
	}

	/**
	 * Get configured on off switch to display.
	 * 
	 * @returns	{?DeviceFeature}
	 */
	getSwitch() {
		if (!this.model.data || !this.model.data.switch)
			return null;

		return devices.getDeviceFeature(this.model.data.switch);
	}

	beforeSave(values) {
		this.model.data = {
			feature: values.feature.uuid,
			switch: (values.switch) ? values.switch.uuid : null
		};
	}

	renderContent() {
		const feature = this.getFeature();
		const button = this.getSwitch();

		if (!feature)
			return "Yêu cầu chọn một núm vặn hoặc đèn để điều khiển";

		if (!this.knob) {
			const options = {
				startAngle: -225,
				endAngle: 45,
				width: 216,
				arcWidth: 16,
				knobSpacing: 48,
				shift: 32,
				square: true,
				labelDistEdge: 64
			};

			if (feature.kind === "FeatureFanMotor")
				options.defaultAngle = -90;

			this.knob = new KnobComponent(options);

			this.blockView = makeTree("div", "block-knob-content", {
				knob: this.knob,
				label: { tag: "div", class: "label", text: "---" }
			});

			this.updateValue = (value, source, sourceId) => {
				if (sourceId === this.id)
					return;

				if (feature.kind === "FeatureRGBLed") {
					this.knob.value = calcColorBrightness(value) / 100;
				} else {
					this.knob.value = value / 100;
				}
			};

			this.knob.onInput((value) => {
				if (!this.currentFeature)
					return;

				value = Math.round(value * 100);

				if (this.currentFeature.kind === "FeatureRGBLed")
					value = updateBrightness(this.currentFeature.getValue(), value);

				this.currentFeature.setValue(value, UPDATE_SOURCE_INTERNAL, this.id);
			});
		}

		if (button) {
			if (!this.switchView) {
				this.switchView = ScreenUtils.renderIcon("powerOff");
				this.switchView.classList.add("switch-toggler");

				this.switchView.addEventListener("click", () => {
					if (!this.currentSwitch)
						return;

					const newValue = !this.currentSwitch.getValue();
					this.switchView.classList.toggle("active", newValue);
					this.currentSwitch.setValue(newValue, UPDATE_SOURCE_INTERNAL, this.id);
				});
			}
			
			this.blockView.appendChild(this.switchView);

			this.updateSwitch = (value, source, sourceId) => {
				if (sourceId === this.id)
					return;

				this.switchView.classList.toggle("active", value);
			};
		}

		if (!this.currentFeature || this.currentFeature.uuid !== feature.uuid) {
			this.blockView.label.innerText = feature.name;

			if (this.currentFeature)
				this.currentFeature.removeValueUpdate(this.updateValue);

			feature.onValueUpdate(this.updateValue);
			this.currentFeature = feature;

			if (feature.kind === "FeatureRGBLed") {
				this.knob.value = calcColorBrightness(feature.getValue()) / 100;
			} else {
				this.knob.value = feature.getValue() / 100;
			}
		}

		if (button && (!this.currentSwitch || this.currentSwitch.uuid !== button.uuid)) {
			if (this.currentSwitch)
				this.currentSwitch.removeValueUpdate(this.updateSwitch);

			button.onValueUpdate(this.updateSwitch);
			this.currentSwitch = button;
			this.switchView.classList.toggle("active", button.getValue());
		}

		return this.blockView;
	}

	destroy() {
		super.destroy();
		this.currentFeature.removeValueUpdate(this.updateValue);
	}
}

class BlockColorWheelRenderer extends DashboardBlockRenderer {
	static get ID() {
		return "colorWheel";
	}

	static get ICON() {
		return "droplet";
	}

	constructor(model) {
		super(model);

		this.form = new ScreenForm({
			...this.defaultForm,

			content: {
				name: "Đổi màu",
				rows: [
					{
						feature: {
							type: "autocomplete",
							label: "Tính năng",
							required: true,

							options: {
								...featureSearch(FEATURE_FLAG_READ, { includeKinds: ["FeatureRGBLed"] })
							}
						}
					},
					{
						switch: {
							type: "autocomplete",
							label: "Công tắc bật tắt",
							required: false,

							options: {
								...featureSearch(FEATURE_FLAG_READ | FEATURE_FLAG_WRITE, { includeKinds: ["FeatureOnOffToggle", "FeatureButton"] })
							}
						}
					}
				]
			}
		});

		this.fixedContent = true;
	}

	async formDefaultValue() {
		return {
			feature: this.getFeature(),
			switch: this.getSwitch()
		};
	}

	/**
	 * Get configured feature to display.
	 * 
	 * @returns	{?DeviceFeature}
	 */
	getFeature() {
		if (!this.model.data || !this.model.data.feature)
			return null;

		return devices.getDeviceFeature(this.model.data.feature);
	}

	/**
	 * Get configured on off switch to display.
	 * 
	 * @returns	{?DeviceFeature}
	 */
	getSwitch() {
		if (!this.model.data || !this.model.data.switch)
			return null;

		return devices.getDeviceFeature(this.model.data.switch);
	}

	beforeSave(values) {
		this.model.data = {
			feature: values.feature.uuid,
			switch: (values.switch) ? values.switch.uuid : null
		};
	}

	renderContent() {
		const feature = this.getFeature();
		const button = this.getSwitch();

		if (!feature)
			return "Yêu cầu chọn đèn hỗ trợ màu sắc để điều khiển";

		if (!this.wheel) {
			this.blockView = makeTree("div", "block-color-wheel-content", {
				wheel: { tag: "div", class: "wheel" },
				label: { tag: "div", class: "label", text: "---" }
			});

			let updating = false;

			this.wheel = new ReinventedColorWheel({
				appendTo: this.blockView.wheel,
				wheelDiameter: 176,
				wheelThickness: 16,
				handleDiameter: 24,
				wheelReflectsSaturation: true,

				onChange: (color) => {
					if (!this.currentFeature || updating)
						return;

					this.currentFeature.setValue(color.rgb, UPDATE_SOURCE_INTERNAL, this.id);
				}
			});

			this.updateValue = (value, source, sourceId) => {
				if (sourceId === this.id)
					return;

				updating = true;
				this.wheel.rgb = value;
				updating = false;
			};
		}

		if (button) {
			if (!this.switchView) {
				this.switchView = ScreenUtils.renderIcon("powerOff");
				this.switchView.classList.add("switch-toggler");

				this.switchView.addEventListener("click", () => {
					if (!this.currentSwitch)
						return;

					const newValue = !this.currentSwitch.getValue();
					this.switchView.classList.toggle("active", newValue);
					this.currentSwitch.setValue(newValue, UPDATE_SOURCE_INTERNAL, this.id);
				});
			}
			
			this.blockView.appendChild(this.switchView);

			this.updateSwitch = (value, source, sourceId) => {
				if (sourceId === this.id)
					return;

				this.switchView.classList.toggle("active", value);
			};
		}

		if (!this.currentFeature || this.currentFeature.uuid !== feature.uuid) {
			this.blockView.label.innerText = feature.name;

			if (this.currentFeature)
				this.currentFeature.removeValueUpdate(this.updateValue);

			feature.onValueUpdate(this.updateValue);
			this.currentFeature = feature;

			this.wheel.rgb = feature.getValue();
		}

		if (button && (!this.currentSwitch || this.currentSwitch.uuid !== button.uuid)) {
			if (this.currentSwitch)
				this.currentSwitch.removeValueUpdate(this.updateSwitch);

			button.onValueUpdate(this.updateSwitch);
			this.currentSwitch = button;
			this.switchView.classList.toggle("active", button.getValue());
		}

		return this.blockView;
	}

	destroy() {
		super.destroy();
		this.currentFeature.removeValueUpdate(this.updateValue);
	}
}

class BlockScenesRenderer extends DashboardBlockRenderer {
	static get ID() {
		return "scenes";
	}

	static get ICON() {
		return "box";
	}

	static get SIZE() {
		return [3, 1];
	}

	constructor(model) {
		super(model);

		this.form = new ScreenForm({
			...this.defaultForm,

			content: {
				name: "Các cảnh",
				rows: [
					{
						scenes: {
							type: "autocomplete",
							label: "Các cảnh",

							options: {
								fetch: async (search) => {
									const response = await myajax({
										url: app.api(`/scene/list`),
										method: "GET",
										query: { search }
									});
			
									return Scene.processResponses(response.data);
								},

								process: (item) => {
									return {
										label: item.renderItem(),
										value: item.id
									}
								},

								multiple: true
							}
						}
					}
				]
			}
		});

		this.switches = {};
	}

	async formDefaultValue() {
		return {
			scenes: await this.getScenes()
		};
	}

	/**
	 * Get configured scenes to display.
	 * 
	 * @returns	{Promise<Scene[]>}
	 */
	async getScenes() {
		const sceneIds = (this.model.data.scenes)
			? this.model.data.scenes
			: [];

		const scenes = [];

		for (const sceneId of sceneIds)
			scenes.push(await Scene.get(sceneId));

		return scenes;
	}

	beforeSave(values) {
		const scenes = values.scenes
			.map((scene) => scene.id);

		this.model.data = {
			scenes
		};
	}

	renderContent() {
		if (!this.blockView) {
			this.blockView = document.createElement("div");
			this.blockView.classList.add("block-scenes-content");
		}

		emptyNode(this.blockView);

		(async () => {
			const scenes = await this.getScenes();
	
			for (const scene of scenes) {
				if (!this.switches[scene.id]) {
					const switchView = createButton(scene.name, {
						icon: scene.icon,
						color: scene.color,
						onClick: () => scene.execute()
					});

					this.switches[scene.id] = switchView;
					this.blockView.appendChild(switchView);
					continue;
				}
	
				const switchView = this.switches[scene.id];
				this.blockView.appendChild(switchView);
				continue;
			}
		})();

		return this.blockView;
	}

	destroy() {
		super.destroy();
		
		for (const { destroy } of Object.values(this.switches))
			destroy();

		this.switches = {};
	}
}

// Regiser this screen to initialize when application load.
screens.dashboard = dashboard;
