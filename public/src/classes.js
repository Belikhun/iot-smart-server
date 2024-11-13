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

		/** @type {Number} */
		this.created = null;

		/** @type {Number} */
		this.updated = null;
	}

	getAvatarUrl() {
		return app.api(`/user/${this.username}/avatar`);
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

		/** @type {Number} */
		this.created = null;

		/** @type {Number} */
		this.updated = null;
	}

	setValue(newValue = undefined, source = UPDATE_SOURCE_INTERNAL) {
		this.value = newValue;
		clog("INFO", `DeviceFeature(${this.uuid}).setValue(): value=${newValue} source=${source}`);

		if (source !== UPDATE_SOURCE_SERVER)
			clog("DEBG", "Sẽ thực hiện cập nhật máy chủ");
			this.doPushValue();

		if (source !== UPDATE_SOURCE_CONTROL)
			clog("DEBG", "Sẽ thực hiện cập nhật giao diện điều khiển");
			this.doUpdateControl();

		return this.getValue();
	}

	getValue() {
		return this.value;
	}

	doUpdateControl() {

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

	/**
	 * Process response returned from API.
	 *
	 * @param	{object}			response
	 * @param	{Device}			device
	 * @returns	{DeviceFeature}
	 */
	static processResponse(response, device = null) {
		const instance = super.processResponse(response);
		instance.device = device;
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
