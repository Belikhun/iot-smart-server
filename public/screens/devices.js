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

const devices = {
	/**
	 * @typedef {{
	 * 	view: TreeDOM
	 *  device: Device
	 * 	menu: ContextMenu
	 * 	update: () => void
	 * 	edit: () => void
	 * 	delete: () => Promise<void>
	 * }} DeviceView
	 */

	/** @type {TreeDOM} */
	view: undefined,

	/** @type {ScreenChild} */
	screen: undefined,
	
	/** @type {SQButton} */
	updateButton: undefined,

	/** @type {Device[]} */
	current: [],

	/** @type {{ [id: number]: DeviceView }} */
	deviceView: {},

	/** @type {{ [hardwareId: string]: Device }} */
	devices: {},

	/** @type {{ [uuid: string]: DeviceFeature }} */
	features: {},

	/** @type {ScreenForm<Device>} */
	form: undefined,

	initialFetched: false,

	name: "",

	async init() {
		this.name = "Thiết bị";

		this.view = makeTree("div", "device-list", {
			devices: { tag: "div", class: "devices" }
		});

		this.screen = new ScreenChild(
			screens.system,
			"devices",
			"Thiết bị",
			{ noGrid: true }
		);

		this.updateButton = createButton("", {
			icon: "reload",
			onClick: () => this.update()
		});

		this.form = new ScreenForm({
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
					},
					{
						tags: {
							type: "text",
							label: app.string("table.tags")
						},

						area: {
							type: "text",
							label: app.string("table.area")
						}
					}
				]
			}
		});

		this.screen.onSideToggle((showing) => {
			if (!showing)
				this.form.show = false;
		});

		this.screen.content = this.view;
		this.screen.addAction(this.updateButton);

		if (!this.initialFetched) {
			await this.update();
		} else {
			this.renderDevices();
		}

		this.screen.onActivate(() => this.renderDevices());
	},

	/**
	 * Get device instance by hardware ID.
	 * 
	 * @param	{string}			hardwareId
	 * @returns	{?Device}
	 */
	getDevice(hardwareId) {
		if (!this.devices[hardwareId])
			return null;

		return this.devices[hardwareId];
	},

	/**
	 * Get device feature instance by uuid.
	 * 
	 * @param	{string}			uuid
	 * @returns	{?DeviceFeature}
	 */
	getDeviceFeature(uuid) {
		if (!this.features[uuid])
			return null;

		return this.features[uuid];
	},

	/**
	 * Start editing device.
	 *
	 * @param   {Device}     instance
	 */
	edit(instance) {
		devices.screen.showSide({
			title: app.string("model_editing", { model: this.name, name: instance.name }),
			content: this.form.form
		});

		this.form.defaults = {
			...instance,
			tags: instance.tags.join(";")
		};

		this.form.reset();
		this.form.title = app.string("model_editing", { model: this.name, name: instance.name });

		setTimeout(() => {
			this.form.show = true;
		}, 200);

		this.form.onSubmit(async (values) => {
			for (const [name, value] of Object.entries(values))
				instance[name] = value;

			instance.tags = instance.tags.split(";");

			try {
				await instance.save();
			} catch (e) {
				// 221 is FieldError
				if (e.data && e.data.code === 221) {
					this.form.setError(e.data.data.name, e.data.details);
					return;
				}

				throw e;
			}

			devices.screen.alert("OKAY", app.string("model_edited", { model: this.name, name: instance.name }));

			// Set new default and reload table.
			this.form.defaults = instance;
			this.renderDevices();
		});
	},

	async update(render = true) {
		if (this.updateButton)
			this.updateButton.loading = true;

		this.initialFetched = true;

		try {
			const response = await myajax({
				url: app.api("/device/list"),
				method: "GET"
			});

			this.current = Device.processResponses(response.data);

			// Update device dictionary.
			for (const device of this.current) {
				this.devices[device.hardwareId] = device;

				for (const feature of device.features)
					this.features[feature.uuid] = feature;
			}

			if (render || app.screen.active.id === this.screen.id)
				this.renderDevices();
		} catch (e) {
			this.screen.handleError(e);
		}

		if (this.updateButton)
			this.updateButton.loading = false;
	},

	async updateDevice(hardwareId) {
		this.updateButton.loading = true;

		try {
			const response = await myajax({
				url: app.api(`/device/${hardwareId}/info`),
				method: "GET"
			});

			if (!response.data) {
				this.log("WARN", `Không tìm thấy thiết bị với mã phần cứng ${hardwareId}!`);
				this.updateButton.loading = false;
				return;
			}

			const device = Device.processResponse(response.data);

			this.devices[device.hardwareId] = device;
			for (const feature of device.features)
				this.features[feature.uuid] = feature;

			const instance = this.render(device);
			this.view.devices.insertBefore(instance.view, this.view.devices.firstChild);
		} catch (e) {
			this.screen.handleError(e);
		}

		this.updateButton.loading = false;
	},

	renderDevices() {
		emptyNode(this.view.devices);

		for (const device of this.current) {
			const instance = this.render(device);
			this.view.devices.appendChild(instance.view);
		}
	},

	/**
	 * Render the specified device.
	 * 
	 * @param	{Device}		device
	 * @returns	{DeviceView}
	 */
	render(device) {
		if (this.deviceView[device.id]) {
			// Just to make sure we have up-to-date reference.
			const instance = this.deviceView[device.id];
			instance.device = device;
			instance.update();

			return instance;
		}

		const editButton = createButton("", {
			icon: "pencil",
			color: "blue",
			onClick: () => this.edit(instance.device)
		});

		const actionButton = createButton("", {
			icon: "gear",
			color: "accent",
			onClick: () => menu.openAtElement(actionButton)
		});

		let viewType = { tag: "span", class: "type", child: {
			icon: { tag: "icon", icon: device.icon },
			typeName: { tag: "span", class: "name", text: device.hardwareId }
		}};

		if (device.type === "tuya") {
			viewType = { tag: "span", class: "type", child: {
				icon: { tag: "img", src: app.url("/public/images/tuya-mono.svg") },
				typeName: { tag: "span", class: "name", text: `Tuya (${device.hardwareId})` }
			}};
		}

		const view = makeTree("div", ["map-color", "device-info"], {
			info: { tag: "div", class: "info", child: {
				type: viewType,

				info: { tag: "span", class: "info", child: {
					qName: { tag: "span", class: "name", text: device.name },
					status: ScreenUtils.renderBadge("status")
				}},

				space: { tag: "span", class: "space" },

				meta: { tag: "span", class: "meta", child: {
					deviceId: { tag: "span", class: ["item", "deviceId"], child: {
						value: { tag: "span", text: `#${device.id}` }
					}},

					sep1: { tag: "dot" },

					area: { tag: "span", class: ["item", "area"], child: {
						label: { tag: "label", text: "vùng" },
						value: { tag: "span", text: device.area ? device.area : "chưa gán" }
					}}
				}},

				actions: ScreenUtils.buttonGroup(editButton, actionButton)
			}},

			tags: { tag: "div", class: "tags" },
			content: { tag: "div", class: "content" },

			footer: { tag: "div", class: "footer", child: {
				timestamp: { tag: "span" },
				token: { tag: "span", class: "token", text: device.token }
			}}
		});

		view.dataset.id = device.id;
		view.dataset.color = device.color;

		const menu = new ContextMenu(view.info);

		menu.add({ id: "config", text: "Trang cấu hình", icon: "externalLink" })
			.add({ id: "reset", text: "Khởi động lại", icon: "powerOff" })
			.separator()
			.add({ id: "edit", text: app.string("action.edit"), icon: "pencil" })
			.add({ id: "unpair", text: app.string("action.unpair"), icon: "linkHorizontalSlash", color: "red" });

		/** @type {DeviceView} */
		const instance = {
			device,
			menu,
			view
		};

		instance.update = () => {
			view.dataset.color = instance.device.color;
			view.info.type.icon.dataset.icon = instance.device.icon;
			view.info.info.qName.innerText = instance.device.name;
			view.info.info.status.innerText = instance.device.connected ? "Trực Tuyến" : "Ngoại Tuyến";
			view.info.info.status.dataset.color = instance.device.connected ? "green" : "red";

			view.footer.token.innerText = instance.device.token;

			const timestamp = ScreenUtils.renderFlexRow(
				device.address ? ScreenUtils.renderCopyableText({ display: device.address }) : null,
				device.address ? document.createElement("dot") : null,
				relativeTime(instance.device.created, { returnNode: true })
			);

			view.footer.replaceChild(timestamp, view.footer.timestamp);
			view.footer.timestamp = timestamp;

			emptyNode(view.content);
			for (const feature of instance.device.features)
				view.content.appendChild(feature.render());

			if (instance.device.tags.length <= 0) {
				emptyNode(view.tags);
				view.tags.style.display = "none";
			} else {
				emptyNode(view.tags);
				view.tags.style.display = null;

				for (const tag of instance.device.tags)
					view.tags.appendChild(ScreenUtils.renderTag(tag));
			}

			menu.disable("config", !instance.device.connected);
		};

		instance.edit = () => this.edit(instance.device);

		instance.delete = async () => {
			// try {
			// 	await myajax({
			// 		url: this.route(`question/${device.id}/delete`),
			// 		method: "DELETE"
			// 	});

			// 	this.screen.alert("OKAY", app.string("question_deleted", {
			// 		name: question.name,
			// 		id: device.id,
			// 		department: this.currentDepartment.name
			// 	}));

			// 	this.updateQuestions();
			// } catch (e) {
			// 	this.screen.handleError(e);
			// }
		};

		menu.onSelect(async (id) => {
			switch (id) {
				case "config": {
					if (!instance.device.address)
						return;

					window.open(`http://${instance.device.address}`, "_blank");
					break;
				}

				case "reset": {
					if (!instance.device.connected)
						return;

					instance.device.reset();
					break;
				}

				case "edit":
					instance.edit();
					break;

				case "unlink":
					await instance.delete();
					break;
			}
		});

		this.deviceView[device.id] = instance;
		instance.update();
		return instance;
	}
}

// Regiser this screen to initialize when application load.
screens.devices = devices;
