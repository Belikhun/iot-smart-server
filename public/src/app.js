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
 * Vloom Dashboard main page.
 *
 * @package     vloom_core
 * @author      Brindley <brindley@videabiz.com>
 * @copyright   2023 Videa {@link https://videabiz.com}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

DEBUG = true;

const app = {
	root: document.getElementById("app"),

	data: {},
	strings: {},

	/** @type {((size: "desktop"|"tablet"|"mobile") => void)[]} */
	screenModeChangeListeners: [],
	currentScreenMode: null,

	/** @type {?ContextMenu} */
	currentContextMenu: null,

	init() {
		this.root.style.setProperty("--accent", this.data.accent);
		this.root.style.setProperty("--accent-raw", this.data.accentRaw.join(" "));

		popup.init();
		addEventListener("resize", () => this.updateScreenMode());
		this.updateScreenMode();
		initGroup(this, "app");
	},

	string(name, args = {}) {
		if (!this.strings[name]) {
			clog("WARN", `String not found: ${name}`);
			return `string:${name}`;
		}

		/** @type {String} */
		let string = this.strings[name];

		for (let [key, value] of Object.entries(args))
			string = string.replace(`:${key}:`, value);

		return string;
	},

	api(path) {
		return `${this.data.apiBase}${path}`;
	},

	url(path) {
		return `${this.data.urlBase}${path}`;
	},

	/**
	 * Return hex code of specified color name
	 * @param	{"accent" | string}	color
	 * @returns	{string}
	 */
	color(color) {
		if (color === "accent")
			return this.data.accent;

		return oscColor(color);
	},

	updateScreenMode() {
		let mode = "desktop";

		if (this.root.clientWidth <= 640)
			mode = "mobile";
		else if (this.root.clientWidth <= 1020)
			mode = "tablet";

		if (mode !== this.currentScreenMode) {
			clog("INFO", `Screen mode changed to`, mode);

			for (let listener of this.screenModeChangeListeners) {
				try {
					listener(mode);
				} catch (e) {
					clog("WARN", `app.updateScreenMode(): listener handled with error`, e);
				}
			}
		}

		this.currentScreenMode = mode;
	},

	/**
	 * Register for screen mode change event.
	 *
	 * @param   {(size: "desktop"|"tablet"|"mobile") => void}   f
	 * @returns {Number}
	 */
	onScreenModeChange(f) {
		f(this.currentScreenMode);
		return this.screenModeChangeListeners.push(f);
	},

	/**
	 * Get current screen mode.
	 *
	 * @return {"desktop"|"tablet"|"mobile"}
	 */
	getScreenMode() {
		return this.currentScreenMode;
	},

	navbar: {
		/** @type {HTMLElement} */
		container: undefined,

		/** @type {ContextMenu} */
		userMenu: undefined,

		init() {
			this.container = makeTree("nav", "nav", {
				left: { tag: "div", class: "left", child: {
					brand: new lazyload({ source: app.url("/public/images/logo-32.png"), classes: "sitelogo", tagName: "a" }),
				}},

				middle: { tag: "div", class: "middle" },

				right: { tag: "div", class: "right", child: {
					config: { tag: "icon", icon: "gear", class: "config" },
					sep2: { tag: "span", class: "separator" },

					notifications: { tag: "icon", icon: "bell", class: "notifications" },
					sep3: { tag: "span", class: "separator" },

					user: { tag: "span", class: "user", child: {
						fullname: { tag: "div", class: "name", text: app.string("guest") },
						image: new lazyload({ classes: "userimage" }),
						icon: { tag: "icon", icon: "caretDown", class: "caret" }
					}}
				}}
			});

			this.userMenu = new ContextMenu(this.container.right.user, { fixed: true });

			this.userMenu
				.add({ id: "profile", icon: "user", text: app.string("menu.profile") })
				.separator()
				.add({ id: "logout", icon: "logout", text: app.string("menu.logout") });

			this.userMenu.onSelect((name) => {
				switch (name) {
					case "profile":
						window.open(app.url(`/user/profile.php`), "_blank");
						break;

					case "logout":
						window.location = app.data.logoutUrl;
						break;
				}
			});

			app.root.appendChild(this.container);
		}
	},

	tooltip: {
		init() {
			tooltip.init();
		}
	},

	screen: {
		/** @type {TreeDOM} */
		container: undefined,

		/** @type {{ [id: string]: ScreenChild }} */
		instances: {},

		/** @type {ScreenChild} */
		active: null,

		init() {
			this.container = makeTree("div", "screens", {
				menu: { tag: "div", class: "menu", child: {
					header: { tag: "div", class: "header", child: {
						hTitle: { tag: "div", class: "title", text: app.string("pagetitle") }
					}}
				}},

				content: { tag: "div", class: "content" }
			});

			app.root.appendChild(this.container);
		},

		/**
		 * Parse current screen and state from hash.
		 *
		 * @param	{string}	hash
		 */
		activateByHash(hash) {
			if (!hash || hash.length === 0)
				return;

			this.log("DEBG", `Got current location hash:`, hash);

			if (hash[0] === "#")
				hash = hash.substring(1);

			const [screen, ...data] = hash.split("-");
			const state = {};

			for (const item of data) {
				let [name, value] = item.split(":");

				if (value === "" || value === "null")
					value = null;

				if (!Number.isNaN(value)) {
					value = (value.includes("."))
						? Number.parseFloat(value)
						: Number.parseInt(value);
				}

				state[name] = value;
			}

			if (!this.instances[screen]) {
				this.log("WARN", `Location hash is requesting an undefined screen (${screen}). Ignoring...`);
				return;
			}

			this.log("INFO", `Activating screen ${screen} with state`, state);
			this.instances[screen].activate(state);
		}
	},

	screens
};
