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
 * Vloom Dashboard.
 *
 * @package     vloom_core
 * @author      Brindley <brindley@videabiz.com>
 * @copyright   2023 Videa {@link https://videabiz.com}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

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

				content: { tag: "div", class: "content" }
			});

			this.view.draggable = false;
			this.view.header.draggable = true;
			this.view.content.draggable = false;
			this.view.header.addEventListener("contextmenu", (e) => this.menu.openByMouseEvent(e));
		}

		this.view.dataset.color = this.model.color;
		this.view.header.blade.titl.innerText = this.model.name;
		emptyNode(this.view.content);

		const content = this.renderContent();
		if (isElement(content)) {
			this.view.content.appendChild(content);
		} else {
			this.view.content.innerHTML = content;
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

		this.switches = {};
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
								...featureSearch(FEATURE_FLAG_READ, { includeKinds: ["FeatureKnob", "FeatureRGBLed"] })
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
			return "Yêu cầu chọn một núm vặn hoặc đèn để điều khiển";

		if (!this.knob) {
			this.knob = new KnobComponent({
				startAngle: -225,
				endAngle: 45,
				width: 216,
				arcWidth: 16,
				knobSpacing: 48,
				shift: 32,
				square: true,
				labelDistEdge: 64
			});

			this.blockView = makeTree("div", "block-knob-content", {
				knob: this.knob,
				label: { tag: "div", class: "label", text: "---" }
			});

			this.updateValue = (value, source, sourceId) => {
				if (sourceId === this.id)
					return;

				this.knob.value = value;
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

		if (!this.currentFeature || this.currentFeature.uuid !== feature.uuid) {
			this.blockView.label.innerText = feature.name;

			if (this.currentFeature)
				this.currentFeature.removeValueUpdate(this.updateValue);

			feature.onValueUpdate(this.updateValue);
			this.currentFeature = feature;

			if (feature.kind === "FeatureRGBLed") {
				this.knob.value = calcColorBrightness(feature.getValue());
			} else {
				this.knob.value = feature.getValue() / 100;
			}
		}

		return this.blockView;
	}

	destroy() {
		super.destroy();
		this.currentFeature.removeValueUpdate(this.updateValue);
	}
}

// Regiser this screen to initialize when application load.
screens.dashboard = dashboard;
