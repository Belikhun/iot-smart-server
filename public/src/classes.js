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
 * Model classes used in dashboard.
 *
 * @package     vloom_dashboard
 * @author      Brindley <brindley@videabiz.com>
 * @copyright   2023 Videa {@link https://videabiz.com}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Cache received model instances.
 *
 * @type {{ [className: String]: { [id: Number]: Model } }}
 */
const MODEL_INSTANCES = {};

/**
 * Base model
 */
class Model {

	/**
	 * Should we ignore the updated timestamp check when parsing api
	 * response.
	 *
	 * @type {boolean}
	 */
	get IGNORE_UPDATED_CHECK() {
		return false;
	}

	constructor(id) {
		/** @type {number} */
		this.id = id;

		/**
		 * Extra save data will be appended to save request body.
		 * This field will be resetted after every save call.
		 *
		 * @type {object}
		 */
		this.extraSaveData = {};
	}

	display() {
		return this.name;
	}

	async save() {
		throw new Error("NotImplemented");
	}

	async delete() {
		throw new Error("NotImplemented");
	}

	/**
	 * Process response returned from API.
	 *
	 * @param   {object}	response
	 * @returns {this}
	 */
	static processResponse(response) {
		const hasInstance = (typeof MODEL_INSTANCES[this.name] === "object")
			&& (typeof MODEL_INSTANCES[this.name][response.id] === "object");

		let instance;

		if (hasInstance) {
			instance = MODEL_INSTANCES[this.name][response.id];

			for (let key of Object.keys(instance)) {
				if (["id", "extraSaveData"].includes(key))
					continue;

				if (typeof response[key] === "undefined")
					continue;

				const value = response[key];

				if (typeof instance[key] === "object" && instance[key] && typeof instance[key].id !== "undefined") {
					if (value === null)
						continue;

					if (typeof value === "object" && value && !instance.IGNORE_UPDATED_CHECK) {
						// Skip updating if object id and updated time are the same.
						const changed = (value.id !== instance[key].id)
							|| (instance[key].updated !== value.updated);

						if (!changed)
							continue;
					}
				}

				instance[key] = this.processField(key, value, response, instance);
			}

			clog(`DEBG`, {
				text: "MODEL_INSTANCES",
				color: oscColor("green")
			}, {
				text: "UPDATE",
				color: oscColor("purple")
			}, {
				text: `${this.name} [${instance.id}]`,
				color: oscColor("pink")
			});
		} else {
			instance = new this(response.id);

			for (let key of Object.keys(instance)) {
				if (["id", "extraSaveData"].includes(key))
					continue;

				if (typeof response[key] === "undefined")
					continue;

				const value = response[key];

				if (value === null) {
					instance[key] = null;
					continue;
				}

				instance[key] = this.processField(key, value, response, instance);
			}

			if (typeof MODEL_INSTANCES[this.name] !== "object")
				MODEL_INSTANCES[this.name] = {};

			MODEL_INSTANCES[this.name][instance.id] = instance;

			clog(`DEBG`, {
				text: "MODEL_INSTANCES",
				color: oscColor("green")
			}, {
				text: "CREATE",
				color: oscColor("orange")
			}, {
				text: `${this.name} [${instance.id}]`,
				color: oscColor("pink")
			});
		}

		return instance;
	}

	/**
	 * Process field value based on name.
	 *
	 * @param	{String}		name
	 * @param	{any}			value
	 * @param	{Object}		response
	 * @param	{Model}			instance
	 */
	static processField(name, value) {
		return value;
	}

	/**
	 * Process response returned from API.
	 *
	 * @param   {Object[]}	responses
	 * @returns {this[]}
	 */
	static processResponses(responses) {
		const instances = [];

		for (const response of responses)
			instances.push(this.processResponse(response));

		return instances;
	}
}

class Session extends Model {
	constructor(id) {
		super(id);

		/** @type {string} */
		this.sessionId = null;

		/** @type {User} */
		this.user = null;

		/** @type {string} */
		this.ipAddress = null;

		/** @type {number} */
		this.expire = null;

		/** @type {Number} */
		this.created = null;

		/** @type {Number} */
		this.updated = null;
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object}		response
	 * @returns	{Session}
	 */
	static processResponse(response) {
		return super.processResponse(response);
	}

	static processField(name, value) {
		switch (name) {
			case "user":
				return User.processResponse(value);
		}

		return super.processField(name, value);
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object[]}		responses
	 * @returns	{Session[]}
	 */
	static processResponses(responses) {
		const instances = [];

		for (let response of responses)
			instances.push(this.processResponse(response));

		return instances;
	}
}

class User extends Model {
	constructor(id) {
		super(id);

		/** @type {string} */
		this.username = null;

		/** @type {string} */
		this.name = null;

		/** @type {string} */
		this.email = null;

		/** @type {?string} */
		this.lastIP = null;

		/** @type {boolean} */
		this.isAdmin = null;

		/** @type {?number} */
		this.lastAccess = null;

		/** @type {?string} */
		this.password = null;

		/** @type {Number} */
		this.created = null;

		/** @type {Number} */
		this.updated = null;
	}

	getAvatarUrl() {
		return app.api(`/user/${this.username}/avatar`);
	}

	/**
	 * Render mini profile of this user.
	 *
	 * @returns {HTMLDivElement}
	 */
	render() {
		const node = makeTree("a", "user-info", {
			image: new lazyload({ source: this.getAvatarUrl(), classes: "avatar" }),
			fullname: { tag: "div", class: "name", text: this.name },

			badge: (this.isAdmin)
				? ScreenUtils.renderBadge("ADMIN", "blue")
				: null
		});

		return node;
	}

	async save() {
		const data = {
			username: this.username,
			name: this.name,
			email: this.email,
			isAdmin: this.isAdmin,
			password: this.password,
			...this.extraSaveData
		};

		if (this.id) {
			const response = await myajax({
				url: app.api(`/user/${this.id}/edit`),
				method: "POST",
				json: data
			});

			this.extraSaveData = {};
			return User.processResponse(response.data);
		} else {
			const response = await myajax({
				url: app.api(`/user/create`),
				method: "POST",
				json: data
			});

			this.extraSaveData = {};
			return User.processResponse(response.data);
		}
	}

	async delete() {
		await myajax({
			url: app.api(`/user/${this.id}/delete`),
			method: "DELETE"
		});

		this.id = null;
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object}		response
	 * @returns	{User}
	 */
	static processResponse(response) {
		return super.processResponse(response);
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object[]}		responses
	 * @returns	{User[]}
	 */
	static processResponses(responses) {
		return super.processResponses(responses);
	}
}

class Device extends Model {
	constructor(id) {
		super(id);

		/** @type {string} */
		this.hardwareId = null;

		/** @type {string} */
		this.name = null;

		/** @type {string} */
		this.icon = null;

		/** @type {string} */
		this.color = null;

		/** @type {string[]} */
		this.tags = null;

		/** @type {?string} */
		this.area = null;

		/** @type {DeviceFeature[]} */
		this.features = null;

		/** @type {string} */
		this.token = null;

		/** @type {boolean} */
		this.connected = null;

		/** @type {?string} */
		this.address = null;

		/** @type {Number} */
		this.created = null;

		/** @type {Number} */
		this.updated = null;
	}

	renderItem() {
		return ScreenUtils.renderSpacedRow(
			ScreenUtils.renderIcon(this.icon, { color: this.color }),
			ScreenUtils.renderLink(this.name, null, { isExternal: false, color: this.color })
		);
	}

	reset() {
		websocket.send("reset", true, this.hardwareId);
		return this;
	}

	async save() {
		const data = {
			name: this.name,
			icon: this.icon,
			color: this.color,
			tags: this.tags,
			area: this.area,
			...this.extraSaveData
		};

		let response;

		if (this.id) {
			response = await myajax({
				url: app.api(`/device/${this.id}/edit`),
				method: "POST",
				json: data
			});
		} else {
			throw new Error("NOT_SUPPORTED");
		}

		this.extraSaveData = {};
		return Device.processResponse(response.data);
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object}		response
	 * @returns	{Device}
	 */
	static processResponse(response) {
		return super.processResponse(response);
	}

	static processField(name, value, response, instance) {
		switch (name) {
			case "features":
				return DeviceFeature.processResponses(value, instance);
		}

		return super.processField(name, value);
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object[]}		responses
	 * @returns	{Device[]}
	 */
	static processResponses(responses) {
		return super.processResponses(responses);
	}
}

const UPDATE_SOURCE_INTERNAL = "internal";
const UPDATE_SOURCE_SERVER = "server";
const UPDATE_SOURCE_CONTROL = "control";
const FEATURE_FLAG_READ = 1;
const FEATURE_FLAG_WRITE = 2;

class DeviceFeature extends Model {
	constructor(id) {
		super(id);

		/** @type {number} */
		this.deviceId = null;

		/** @type {Device} */
		this.device = null;

		/** @type {string} */
		this.featureId = null;

		/** @type {string} */
		this.uuid = null;

		/** @type {string} */
		this.name = null;

		/** @type {string} */
		this.kind = null;

		/** @type {any} */
		this.value = null;

		/** @type {any} */
		this.previousValue = null;

		/** @type {number} */
		this.flags = null;

		/** @type {object} */
		this.extras = null;

		/** @type {FeatureRenderer} */
		this.renderer = null;

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
			}
		}, { simple: true });

		this.valueUpdateHandlers = [];

		/** @type {Number} */
		this.created = null;

		/** @type {Number} */
		this.updated = null;
	}

	getIcon() {
		const { icon } = (FeatureRenderer.FEATURES[this.kind])
			? FeatureRenderer.FEATURES[this.kind]
			: { icon: "toggleOn" };

		return icon;
	}

	renderItem() {
		return ScreenUtils.renderInstanceDisplay(
			ScreenUtils.renderSpacedRow(
				ScreenUtils.renderIcon(this.getIcon(), { color: this.device.color }),
				ScreenUtils.renderLink(this.name, null, { isExternal: false, color: this.device.color })
			),
			[this.device.renderItem()]
		)
	}

	/**
	 * Get instance by ID, will return cached version
	 * if available.
	 *
	 * @param		{Number}				id
	 * @returns		{Promise<DeviceFeature>}
	 */
	static async get(id) {
		if (typeof MODEL_INSTANCES[this.name][id] === "object")
			return MODEL_INSTANCES[this.name][id];

		throw new Error("Not Implemented");
	}

	/**
	 * Does this feature support the specified flag?
	 * 
	 * @param		{number}	flag 
	 * @returns		{boolean}
	 */
	support(flag) {
		return ((this.flags & flag) > 0);
	}

	render() {
		if (this.renderer)
			return this.renderer.render();

		this.renderer = FeatureRenderer.instance(this);
		this.renderer.control.value = this.value;
		return this.renderer.render();
	}

	setValue(newValue = undefined, source = UPDATE_SOURCE_INTERNAL, sourceId = null) {
		if (this.getValue() == newValue)
			return this.getValue();

		this.value = newValue;
		clog("INFO", `DeviceFeature(${this.uuid}).setValue(): value=${newValue} source=${source} sourceId=${sourceId}`);

		for (const handler of this.valueUpdateHandlers) {
			try {
				handler(this.value, source, sourceId);
			} catch (e) {
				clog("WARN", `DeviceFeature(${this.uuid}).setValue(): lỗi khi xử lý hàm lắng nghe:`, e);
				continue;
			}
		}

		if (source !== UPDATE_SOURCE_SERVER) {
			clog("DEBG", "Sẽ thực hiện cập nhật máy chủ");
			this.doPushValue();
		}

		if (source !== UPDATE_SOURCE_CONTROL) {
			clog("DEBG", "Sẽ thực hiện cập nhật giao diện điều khiển");
			this.doUpdateControl();
		}

		return this.getValue();
	}

	getValue() {
		return this.value;
	}

	/**
	 * Register a handler on value updated of this feature.
	 * 
	 * @param	{(value: any, source: "internal" | "server" | "control", sourceId: ?string) => void}	handler
	 * @return	{this}
	 */
	onValueUpdate(handler) {
		if (typeof handler !== "function")
			throw new Error(`DeviceFeature(${this.uuid}).onValueUpdate(): hàm lắng nghe không phải là một hàm hợp lệ!`);

		this.valueUpdateHandlers.push(handler);
		return this;
	}

	removeValueUpdate(handler) {
		if (typeof handler !== "function")
			throw new Error(`DeviceFeature(${this.uuid}).removeValueUpdate(): không phải là một hàm hợp lệ!`);

		const index = this.valueUpdateHandlers.indexOf(handler);

		if (index >= 0)
			this.valueUpdateHandlers.splice(index, 1);

		return this;
	}

	doUpdateControl() {
		if (this.renderer)
			this.renderer.control.value = this.value;

		return this;
	}

	doPushValue() {
		websocket.send("update", this.getUpdateData(), this.uuid);
		return this;
	}

	getUpdateData() {
		return {
			id: this.deviceId,
			uuid: this.uuid,
			value: this.getValue()
		}
	}

	async rename(newName) {
		const response = await myajax({
			url: app.api(`/device/${this.deviceId}/feature/${this.id}/rename`),
			method: "POST",
			json: { name: newName }
		});

		DeviceFeature.processResponse(response.data);
		devices.renderDevices();
		return this;
	}

	startRename() {
		popup.show({
			windowTitle: `Tính năng ${this.name}`,
			title: "Đổi tên",
			message: "",
			icon: "pencil",
			bgColor: "accent",
			customNode: this.form.container
		}).then(() => {
			this.form.show = false;
			return;
		}).catch(() => {});

		this.form.defaults = { name: this.name };
		this.form.reset();

		setTimeout(() => {
			this.form.show = true;
		}, 200);

		this.form.onSubmit(async (values) => {
			try {
				await this.rename(values.name);
				app.screen.active.alert("OKAY", `Đã cập nhật tên tính năng thành ${values.name}`);
			} catch (e) {
				// 221 is FieldError
				if (e.data && e.data.code === 221) {
					this.form.setError(e.data.data.name, e.data.details);
					return;
				}

				app.screen.active.handleError(e);
			}

			this.form.show = false;
			popup.hide();
		});
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object}			response
	 * @param	{Device}			device
	 * @returns	{DeviceFeature}
	 */
	static processResponse(response, device = null) {
		const instance = super.processResponse(response);

		if (device)
			instance.device = device;

		instance.setValue(instance.getValue(), UPDATE_SOURCE_SERVER);
		return instance;
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object[]}			responses
	 * @param	{Device}			device
	 * @returns	{DeviceFeature[]}
	 */
	static processResponses(responses, device = null) {
		const instances = [];

		for (const response of responses)
			instances.push(this.processResponse(response, device));

		return instances;
	}
}

class Trigger extends Model {
	constructor(id) {
		super(id);

		/** @type {string} */
		this.name = null;

		/** @type {string} */
		this.icon = null;

		/** @type {string} */
		this.color = null;

		/** @type {number} */
		this.lastTrigger = null;

		/** @type {boolean} */
		this.active = null;

		/** @type {TriggerGroup} */
		this.group = null;

		/** @type {number} */
		this.created = null;

		/** @type {number} */
		this.updated = null;
	}

	/**
	 * Get instance by ID, will return cached version
	 * if available.
	 *
	 * @param		{Number}				id
	 * @returns		{Promise<Trigger>}
	 */
	static async get(id) {
		if (typeof MODEL_INSTANCES[this.name][id] === "object")
			return MODEL_INSTANCES[this.name][id];

		throw new Error("Not Implemented");
	}

	async save() {
		const data = {
			name: this.name,
			icon: this.icon,
			color: this.color,
			active: this.active,
			...this.extraSaveData
		};

		if (this.id) {
			const response = await myajax({
				url: app.api(`/trigger/${this.id}/edit`),
				method: "POST",
				json: data
			});

			this.extraSaveData = {};
			return Trigger.processResponse(response.data);
		} else {
			if (this.parent)
				data.parent = this.parent.id;

			const response = await myajax({
				url: app.api(`/trigger/create`),
				method: "POST",
				json: data
			});

			this.extraSaveData = {};
			return Trigger.processResponse(response.data);
		}
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object}		response
	 * @returns	{Trigger}
	 */
	static processResponse(response) {
		return super.processResponse(response);
	}

	static processField(name, value, response, instance) {
		// switch (name) {
		// 	case "features":
		// 		return TriggerFeature.processResponses(value, instance);
		// }

		return super.processField(name, value);
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object[]}		responses
	 * @returns	{Trigger[]}
	 */
	static processResponses(responses) {
		return super.processResponses(responses);
	}
}

class TriggerGroup extends Model {
	constructor(id) {
		super(id);

		/** @type {Trigger} */
		this.trigger = null;

		/** @type {TriggerGroup | null} */
		this.parent = null;

		/** @type {"and" | "andNot" | "or"} */
		this.operator = null;

		/** @type {number} */
		this.order = null;

		/** @type {"group"} */
		this.kind = "group";

		/** @type {(TriggerGroup | TriggerItem)[]} */
		this.items = [];

		this.operatorMenu = new ContextMenu()
			.add({ id: "and", text: app.string("operator.and"), icon: "check" })
			.add({ id: "andNot", text: app.string("operator.andNot"), icon: "check" })
			.separator()
			.add({ id: "or", text: app.string("operator.or"), icon: "check" });

		this.operatorMenu.items.and.icon.style.display = "none";
		this.operatorMenu.items.andNot.icon.style.display = "none";
		this.operatorMenu.items.or.icon.style.display = "none";

		this.operatorMenu.onOpen(() => {
			this.operatorMenu.items[this.operator].icon.style.display = null;
			this.operatorMenu.items[this.operator].dataset.color = "accent";
		});

		this.operatorMenu.onSelect(async (operator) => {
			if (operator === this.operator)
				return;

			this.operatorMenu.items[this.operator].icon.style.display = "none";
			this.operatorMenu.items[this.operator].dataset.color = "default";

			this.operatorMenu.items[operator].icon.style.display = null;
			this.operatorMenu.items[operator].dataset.color = "accent";

			try {
				await this.setOperator(operator);
			} catch (e) {
				app.screen.active.handleError(e);
			}
		});

		this.createMenu = new ContextMenu()
			.add({ id: "addGroup", text: "Thêm nhóm điều kiện", icon: "layers" })
			.add({ id: "addItem", text: "Thêm điều kiện", icon: "calculatorSimple" });

		this.createMenu.onSelect(async (action) => {
			if (action === "addGroup") {
				await this.createGroup();
				return;
			}

			if (action === "addItem") {
				await this.createItem();
				return;
			}
		});

		/** @type {TreeDOM} */
		this.view = null;

		/** @type {TreeDOM} */
		this.emptyView = null;

		this.createButton = createButton("Thêm", {
			icon: "plus",
			color: "accent",
			onClick: () => this.createMenu.openAtElement(this.createButton)
		});

		this.emptyCreateButton = createButton("Thêm điều kiện mới", {
			icon: "plus",
			color: "accent",
			onClick: () => this.createMenu.openAtElement(this.emptyCreateButton)
		});

		this.deleteButton = createButton("", {
			icon: "trash",
			color: "red",
			onClick: () => this.delete()
		});

		this.savedHandlers = [];

		/** @type {number} */
		this.created = null;

		/** @type {number} */
		this.updated = null;
	}

	/**
	 * Handle saved event
	 * 
	 * @param	{(instance: TriggerGroup) => void}	handler 
	 */
	onSaved(handler) {
		this.savedHandlers.push(handler);
		return this;
	}

	async createGroup() {
		const instance = new TriggerGroup(null);
		instance.trigger = this.trigger;
		instance.parent = this;
		instance.operator = "and";
		await instance.save();

		this.items.push(instance);

		if (this.parent) {
			this.render();
		} else {
			triggers.info.renderConditions();
		}

		return instance;
	}

	async createItem() {
		const instance = new TriggerItem(null);
		instance.trigger = this.trigger;
		instance.group = this;

		this.items.push(instance);
		
		if (this.parent) {
			this.render();
		} else {
			triggers.info.renderConditions();
		}

		return instance;
	}

	render() {
		if (!this.view) {
			this.emptyView = makeTree("div", "empty-message", {
				message: { tag: "div", class: "message", text: "Nhóm điều kiện này hiện đang trống" },
				content: { tag: "div", class: "content", text: "Bạn có thể thêm một điều kiện mới hoặc một nhóm điều kiện mới vào đây." },
				actions: { tag: "div", class: "actions", child: {
					create: this.emptyCreateButton
				}}
			});
	
			this.view = makeTree("div", "trigger-group", {
				header: { tag: "div", class: "header", child: {
					titl: { tag: "span", class: "title", child: {
						icon: { tag: "icon", icon: "ampersand" },
						content: { tag: "div", class: "content", text: "Nếu" },
						condition: { tag: "div", class: "condition", text: app.string(`operator.${this.operator}`) }
					}},
	
					status: { tag: "div", class: "status" },

					actions: { tag: "span", class: "actions", child: {
						group: ScreenUtils.buttonGroup(this.createButton, this.deleteButton)
					}}
				}},
	
				editor: { tag: "div", class: "editor", child: {
					empty: this.emptyView
				}}
			});
	
			this.view.header.status.style.display = "none";
			this.view.header.titl.condition.addEventListener("click", (e) => this.operatorMenu.openByMouseEvent(e));
			this.view.header.titl.condition.addEventListener("contextmenu", (e) => this.operatorMenu.openByMouseEvent(e));
		}
		
		this.view.header.status.style.display = "none";
		this.setOperator(this.operator);
		emptyNode(this.view.editor);

		if (this.items.length === 0) {
			this.view.editor.appendChild(this.emptyView);
		} else {
			for (const item of this.items) {
				this.view.editor.appendChild(item.render());
			}
		}

		return this.view;
	}

	displayTestResult(resultData, container = null) {
		const thisResult = resultData[this.id];

		if (!container && this.view)
			container = this.view.header.status;

		if (container) {
			container.style.display = null;
			emptyNode(container);
		}

		if (!thisResult) {
			if (container) {
				container.appendChild(
					ScreenUtils.renderStatus("INFO", "Không có kết quả")
				);
			}

			return;
		}

		const { type, result, items } = thisResult;

		if (container) {
			container.appendChild(
				(result)
					? ScreenUtils.renderStatus("OKAY", "Đạt")
					: ScreenUtils.renderStatus("ERROR", "Không đạt")
			);
		}

		for (const item of this.items)
			item.displayTestResult(items);
	}

	async setOperator(operator) {
		if (this.operator !== operator) {
			this.operator = operator;
			await this.save();
		}

		if (this.view) {
			this.view.header.titl.icon.dataset.icon = {
				"and": "ampersand",
				"andNot": "notEqual",
				"or": "hexagonCheck"
			}[this.operator];

			this.view.header.titl.condition.innerText = app.string(`operator.${this.operator}`);
		}
	
		return this;
	}

	async delete() {
		if (this.id) {
			await myajax({
				url: app.api(`/trigger/${this.trigger.id}/group/${this.id}/delete`),
				method: "DELETE"
			});
		}

		if (this.parent) {
			const index = this.parent.items.indexOf(this);

			if (index >= 0)
				this.parent.items.splice(index, 1);

			triggers.info.renderConditions();
		} else {
			await triggers.info.updateConditions();
		}
	}

	async save() {
		const data = {
			operator: this.operator,
			...this.extraSaveData
		};

		let response;

		if (this.id) {
			response = await myajax({
				url: app.api(`/trigger/${this.trigger.id}/group/${this.id}/edit`),
				method: "POST",
				json: data
			});
		} else {
			if (!this.parent)
				throw new Error(`Không thể tạo nhóm khi không có cha!`);

			response = await myajax({
				url: app.api(`/trigger/${this.trigger.id}/group/${this.parent.id}/create`),
				method: "POST",
				json: data
			});

			if (!MODEL_INSTANCES[this.constructor.name])
				MODEL_INSTANCES[this.constructor.name] = {};

			this.id = response.data.id;
			MODEL_INSTANCES[this.constructor.name][this.id] = this;
		}

		this.extraSaveData = {};
		const instance = TriggerGroup.processResponse(response.data);

		for (const handler of this.savedHandlers) {
			try {
				await handler(instance);
			} catch (e) {
				app.screen.active.handleError(e, "WARN");
			}
		}

		return instance;
	}

	/**
	 * Get instance by ID, will return cached version
	 * if available.
	 *
	 * @param		{Number}				id
	 * @returns		{Promise<TriggerGroup>}
	 */
	static async get(id) {
		if (typeof MODEL_INSTANCES[this.name][id] === "object")
			return MODEL_INSTANCES[this.name][id];

		throw new Error("Not Implemented");
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object}				response
	 * @returns	{Promise<TriggerGroup>}
	 */
	static async processResponse(response) {
		const instance = super.processResponse(response);
		instance.trigger = await Trigger.get(response.triggerId);
		instance.parent = (response.parentId)
			? await TriggerGroup.get(response.parentId)
			: null;

		instance.items = [];

		for (const item of response.items) {
			if (item.kind === "group")
				instance.items.push(await TriggerGroup.processResponse(item));
			else if (item.kind === "item")
				instance.items.push(await TriggerItem.processResponse(item));
		}

		return instance;
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object[]}				responses
	 * @returns	{Promise<TriggerGroup>[]}
	 */
	static async processResponses(responses) {
		const instances = [];

		for (const response of responses)
			instances.push(await this.processResponse(response));

		return instances;
	}
}

class TriggerItem extends Model {
	constructor(id) {
		super(id);

		/** @type {Trigger} */
		this.trigger = null;

		/** @type {TriggerGroup | null} */
		this.group = null;
		
		/** @type {DeviceFeature} */
		this.deviceFeature = null;

		/** @type {"equal" | "less" | "lessEq" | "more" | "moreEq" | "contains" | "isOn" | "isOff"} */
		this.comparator = null;

		/** @type {any} */
		this.value = null;

		/** @type {number} */
		this.order = null;
		
		/** @type {"item"} */
		this.kind = "item";

		/** @type {TreeDOM} */
		this.view = null;

		this.deleteButton = createButton("", {
			icon: "trash",
			color: "red",
			onClick: () => this.delete()
		});

		/** @type {AutocompleteInputInstance<DeviceFeature>} */
		this.featureInput = createAutocompleteInput({
			id: `trigger_item_select_feature_${randString(7)}`,
			label: "Tính năng",
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

		this.comparatorInput = createAutocompleteInput({
			id: `trigger_item_select_comparator_${randString(7)}`,
			label: "Phép so sánh",
			color: "accent",

			fetch: async (search) => {
				const comparators = Object.keys(Comparators);

				if (!search)
					return comparators;

				const tokens = search
					.toLocaleLowerCase()
					.split(" ");

				return comparators.filter((value) => {
					value = value.toLocaleLowerCase();

					for (const token of tokens) {
						if (!value.includes(token))	
							return false;
					}

					return true;
				});
			},

			process: (item) => {
				return {
					label: ScreenUtils.renderSpacedRow(
						ScreenUtils.renderIcon(Comparators[item].icon),
						app.string(`comparator.${item}`)
					),

					value: item
				}
			},

			onInput: (value, { trusted }) => {
				this.comparator = value;

				if (this.view && trusted) {
					this.render();
					this.doSave();
				}
			}
		});

		this.saveTimeout = null;
		this.currentComparator = null;
		this.valueRequired = true;

		/** @type {number} */
		this.created = null;

		/** @type {number} */
		this.updated = null;
	}

	render() {
		if (!this.view) {
			this.view = makeTree("div", "trigger-item", {
				header: { tag: "div", class: "header", child: {
					titl: { tag: "span", class: "title", child: {
						icon: { tag: "icon", icon: "device" },
						content: { tag: "div", class: "content", text: "Thiết bị" }
					}},

					status: { tag: "div", class: "status" },
	
					actions: { tag: "span", class: "actions", child: {
						create: this.deleteButton
					}}
				}},

				editor: { tag: "div", class: "editor", child: {
					feature: this.featureInput,
					comparator: this.comparatorInput,
					value: { tag: "span", class: "value-wrapper" }
				}}
			});

			this.view.header.status.style.display = "none";
		}

		this.view.header.status.style.display = "none";

		if (this.deviceFeature) {
			this.view.header.titl.icon.dataset.icon = this.deviceFeature.getIcon();
			this.view.header.titl.content.innerText = this.deviceFeature.name;
		} else {
			this.view.header.titl.icon.dataset.icon = "toggleOn";
			this.view.header.titl.content.innerText = "Chọn tính năng";
		}

		if (!this.id)
			this.view.header.titl.content.innerText += " [CHƯA LƯU]";

		this.featureInput.value = this.deviceFeature;
		this.comparatorInput.value = this.comparator;

		if (!this.currentComparator || this.currentComparator.comparator !== this.comparator) {
			emptyNode(this.view.editor.value);
			this.currentComparator = renderComparatorValue(this.comparator);

			if (this.currentComparator.view) {
				this.view.editor.value.style.display = null;
				this.view.editor.value.appendChild(this.currentComparator.view);
				this.currentComparator.value = this.value;
				this.valueRequired = true;
				
				this.currentComparator.onInput((value) => {
					if (typeof value === "string" && value.length === 0)
						return;

					this.value = value;
					this.doSave();
				});
			} else {
				this.view.editor.value.style.display = "none";
				this.value = null;
				this.valueRequired = false;
			}
		}

		return this.view;
	}

	displayTestResult(resultData) {
		const thisResult = resultData[this.id];

		if (this.view) {
			this.view.header.status.style.display = null;
			emptyNode(this.view.header.status);
		}

		if (!thisResult) {
			if (this.view) {
				this.view.header.status.appendChild(
					ScreenUtils.renderStatus("INFO", "Không có kết quả")
				);
			}

			return;
		}

		const { type, result } = thisResult;

		if (this.view) {
			this.view.header.status.appendChild(
				(result)
					? ScreenUtils.renderStatus("OKAY", "Đạt")
					: ScreenUtils.renderStatus("ERROR", "Không đạt")
			);
		}
	}

	doSave() {
		clearTimeout(this.saveTimeout);

		if (!this.deviceFeature || !this.comparator)
			return;

		if (this.valueRequired && !this.value)
			return;

		this.saveTimeout = setTimeout(async () => {
			this.featureInput.disabled = true;
			this.comparatorInput.disabled = true;

			if (this.currentComparator)
				this.currentComparator.disabled = true;

			try {
				await this.save();
	
				if (this.view)
					this.render();
			} catch (e) {
				app.screen.active.handleError(e);
			}

			this.featureInput.disabled = false;
			this.comparatorInput.disabled = false;

			if (this.currentComparator && this.currentComparator.input)
				this.currentComparator.disabled = false;

			this.saveTimeout = null;
		}, 500);
	}

	async save() {
		const data = {
			deviceFeature: this.deviceFeature.id,
			comparator: this.comparator,
			value: this.value,
			...this.extraSaveData
		};

		let response;

		if (this.id) {
			response = await myajax({
				url: app.api(`/trigger/${this.trigger.id}/item/${this.id}/edit`),
				method: "POST",
				json: data
			});
		} else {
			if (!this.group)
				throw new Error(`Không thể tạo điều kiện khi không có cha!`);

			response = await myajax({
				url:  app.api(`/trigger/${this.trigger.id}/group/${this.group.id}/item/create`),
				method: "POST",
				json: data
			});

			if (!MODEL_INSTANCES[this.constructor.name])
				MODEL_INSTANCES[this.constructor.name] = {};

			this.id = response.data.id;
			MODEL_INSTANCES[this.constructor.name][this.id] = this;
		}

		this.extraSaveData = {};
		const instance = TriggerItem.processResponse(response.data);
		return instance;
	}

	async delete() {
		if (this.id) {
			await myajax({
				url: app.api(`/trigger/${this.trigger.id}/item/${this.id}/delete`),
				method: "DELETE"
			});
		}

		if (this.group) {
			const index = this.group.items.indexOf(this);

			if (index >= 0)
				this.group.items.splice(index, 1);

			triggers.info.renderConditions();
		} else {
			await triggers.info.updateConditions();
		}
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object}				response
	 * @returns	{Promise<TriggerItem>}
	 */
	static async processResponse(response) {
		const instance = super.processResponse(response);
		instance.trigger = await Trigger.get(response.triggerId);
		instance.group = await TriggerGroup.get(response.groupId);
		instance.deviceFeature = await DeviceFeature.get(response.deviceFeatureId);
		return instance;
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object[]}				responses
	 * @returns	{Promise<TriggerItem[]>}
	 */
	static async processResponses(responses) {
		const instances = [];

		for (const response of responses)
			instances.push(await this.processResponse(response));

		return instances;
	}
}

class TriggerAction extends Model {
	constructor(id) {
		super(id);

		/** @type {Trigger} */
		this.trigger = null;

		/** @type {DeviceFeature} */
		this.deviceFeature = null;

		/** @type {"setValue" | "setFromFeature" | "toggleValue"} */
		this.action = null;

		/** @type {any} */
		this.newValue = null;

		/** @type {TreeDOM} */
		this.view = null;

		this.deleteButton = createButton("", {
			icon: "trash",
			color: "red",
			onClick: () => this.delete()
		});

		/** @type {AutocompleteInputInstance<DeviceFeature>} */
		this.featureInput = createAutocompleteInput({
			id: `trigger_item_select_feature_${randString(7)}`,
			label: "Tính năng",
			color: "accent",

			...featureSearch(FEATURE_FLAG_WRITE),

			onInput: (value, { trusted }) => {
				this.deviceFeature = value;

				if (this.view && trusted) {
					this.render();
					this.doSave();
				}
			}
		});

		this.actionInput = createAutocompleteInput({
			id: `trigger_item_select_action_${randString(7)}`,
			label: "Hành động",
			color: "accent",

			fetch: async (search) => {
				const actions = Object.keys(ActionTypes);

				if (!search)
					return actions;

				const tokens = search
					.toLocaleLowerCase()
					.split(" ");

				return actions.filter((value) => {
					value = value.toLocaleLowerCase();

					for (const token of tokens) {
						if (!value.includes(token))	
							return false;
					}

					return true;
				});
			},

			process: (item) => {
				return {
					label: ScreenUtils.renderSpacedRow(
						ScreenUtils.renderIcon(ActionTypes[item].icon),
						app.string(`action.${item}`)
					),

					value: item
				}
			},

			onInput: (value, { trusted }) => {
				this.action = value;

				if (this.view && trusted) {
					this.render();
					this.doSave();
				}
			}
		});

		this.saveTimeout = null;
		this.currentAction = null;
		this.valueRequired = true;

		/** @type {number} */
		this.created = null;

		/** @type {number} */
		this.updated = null;
	}

	render() {
		if (!this.view) {
			this.view = makeTree("div", "trigger-item", {
				header: { tag: "div", class: "header", child: {
					titl: { tag: "span", class: "title", child: {
						icon: { tag: "icon", icon: "device" },
						content: { tag: "div", class: "content", text: "Thiết bị" }
					}},

					actions: { tag: "span", class: "actions", child: {
						create: this.deleteButton
					}}
				}},

				editor: { tag: "div", class: "editor", child: {
					feature: this.featureInput,
					action: this.actionInput,
					value: { tag: "span", class: "value-wrapper" }
				}}
			});
		}

		if (this.deviceFeature) {
			this.view.header.titl.icon.dataset.icon = this.deviceFeature.getIcon();
			this.view.header.titl.content.innerText = this.deviceFeature.name;
		} else {
			this.view.header.titl.icon.dataset.icon = "toggleOn";
			this.view.header.titl.content.innerText = "Chọn tính năng";
		}

		if (!this.id)
			this.view.header.titl.content.innerText += " [CHƯA LƯU]";

		this.featureInput.value = this.deviceFeature;
		this.actionInput.value = this.action;

		if (!this.currentAction || this.currentAction.action !== this.action) {
			emptyNode(this.view.editor.value);
			this.currentAction = renderActionValue(this.action);

			if (this.currentAction.view) {
				this.view.editor.value.style.display = null;
				this.view.editor.value.appendChild(this.currentAction.view);
				this.currentAction.value = this.newValue;
				this.valueRequired = true;
				
				this.currentAction.onInput((value) => {
					if (typeof value === "string" && value.length === 0)
						return;

					this.newValue = value;
					this.doSave();
				});
			} else {
				this.view.editor.value.style.display = "none";
				this.newValue = null;
				this.valueRequired = false;
			}
		}

		return this.view;
	}

	doSave() {
		clearTimeout(this.saveTimeout);

		if (!this.deviceFeature || !this.action)
			return;

		if (this.valueRequired && !this.newValue)
			return;

		this.saveTimeout = setTimeout(async () => {
			this.featureInput.disabled = true;
			this.actionInput.disabled = true;

			if (this.currentAction)
				this.currentAction.disabled = true;

			try {
				await this.save();
	
				if (this.view)
					this.render();
			} catch (e) {
				app.screen.active.handleError(e);
			}

			this.featureInput.disabled = false;
			this.actionInput.disabled = false;

			if (this.currentAction && this.currentAction.input)
				this.currentAction.disabled = false;

			this.saveTimeout = null;
		}, 500);
	}

	async save() {
		const data = {
			deviceFeature: this.deviceFeature.id,
			action: this.action,
			newValue: this.newValue,
			...this.extraSaveData
		};

		let response;

		if (this.id) {
			response = await myajax({
				url: app.api(`/trigger/${this.trigger.id}/action/${this.id}/edit`),
				method: "POST",
				json: data
			});
		} else {
			response = await myajax({
				url:  app.api(`/trigger/${this.trigger.id}/action/create`),
				method: "POST",
				json: data
			});

			if (!MODEL_INSTANCES[this.constructor.name])
				MODEL_INSTANCES[this.constructor.name] = {};

			this.id = response.data.id;
			MODEL_INSTANCES[this.constructor.name][this.id] = this;
		}

		this.extraSaveData = {};
		const instance = TriggerAction.processResponse(response.data);
		return instance;
	}

	async delete() {
		if (this.id) {
			await myajax({
				url: app.api(`/trigger/${this.trigger.id}/action/${this.id}/delete`),
				method: "DELETE"
			});
		}

		await triggers.info.updateActions();
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object}				response
	 * @returns	{Promise<TriggerAction>}
	 */
	static async processResponse(response) {
		const instance = super.processResponse(response);
		instance.trigger = await Trigger.get(response.triggerId);
		instance.deviceFeature = await DeviceFeature.get(response.deviceFeatureId);
		return instance;
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object[]}				responses
	 * @returns	{Promise<TriggerAction[]>}
	 */
	static async processResponses(responses) {
		const instances = [];

		for (const response of responses)
			instances.push(await this.processResponse(response));

		return instances;
	}
}

class DashboardItem extends Model {
	constructor(id) {
		super(id);

		/** @type {string} */
		this.name = null;

		/** @type {string} */
		this.icon = null;

		/** @type {string} */
		this.color = null;

		/** @type {number} */
		this.xPos = null;

		/** @type {number} */
		this.yPos = null;

		/** @type {number} */
		this.width = null;

		/** @type {number} */
		this.height = null;

		/** @type {string} */
		this.type = null;

		/** @type {?object} */
		this.data = null;

		/** @type {number} */
		this.created = null;

		/** @type {number} */
		this.updated = null;
	}

	async save() {
		const data = {
			name: this.name,
			icon: this.icon,
			color: this.color,
			xPos: this.xPos,
			yPos: this.yPos,
			width: this.width,
			height: this.height,
			data: this.data,
			...this.extraSaveData
		};

		let response;

		if (this.id) {
			response = await myajax({
				url: app.api(`/dashboard/${this.id}/edit`),
				method: "POST",
				json: data
			});
		} else {
			data.type = this.type;

			response = await myajax({
				url: app.api(`/dashboard/create`),
				method: "POST",
				json: data
			});

			if (!MODEL_INSTANCES[this.constructor.name])
				MODEL_INSTANCES[this.constructor.name] = {};

			this.id = response.data.id;
			MODEL_INSTANCES[this.constructor.name][this.id] = this;
		}

		this.extraSaveData = {};
		return DashboardItem.processResponse(response.data);
	}

	async delete() {
		await myajax({
			url: app.api(`/dashboard/${this.id}/delete`),
			method: "DELETE"
		});

		this.id = null;
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object}			response
	 * @returns	{DashboardItem}
	 */
	static processResponse(response) {
		return super.processResponse(response);
	}

	/**
	 * Process response returned from API.
	 *
	 * @param	{object[]}			responses
	 * @returns	{DashboardItem[]}
	 */
	static processResponses(responses) {
		return super.processResponses(responses);
	}
}
