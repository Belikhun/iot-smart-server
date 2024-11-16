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
 * Vloom Workplace.
 *
 * @package     vloom_workplace
 * @author      Brindley <brindley@videabiz.com>
 * @copyright   2023 Videa {@link https://videabiz.com}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const users = {
	/** @type {ScreenChild} */
	screen: undefined,

	/** @type {ScreenPanel} */
	list: undefined,

	/** @type {PagingBar} */
	listPaging: undefined,

	/** @type {ScreenTable} */
	listTable: undefined,

	/** @type {SQButton} */
	reloadButton: undefined,

	/** @type {SQButton} */
	createButton: undefined,

	/** @type {SQButton} */
	tryAgainButton: undefined,

	/** @type {SQButton} */
	actions: undefined,

	/** @type {ContextMenu} */
	actionMenu: undefined,

	/** @type {ScreenForm} */
	form: undefined,

	/** @type {String} */
	search: undefined,

	/** @type {ScreenImportWizard} */
	importWizard: undefined,

	fields: ["id", "username", "name", "email", "lastAccess", "lastIP"],
	headers: {},
	sort: { by: null, dir: "asc" },
	show: 20,
	fetching: false,
	name: "",

	init() {
		this.name = app.string("table.user");

		this.screen = new ScreenChild(
			screens.accounts,
			"users",
			"Quản lý người dùng"
		);

		this.reloadButton = createButton("", { icon: "reload", color: "blue" });
		this.actions = createButton(app.string("button.actions"), {
			color: "purple",
			icon: "squareCaretDown",
			align: "right",
			classes: "actions"
		});

		this.tryAgainButton = createButton(app.string("button.tryAgain"), {
			onClick: async () => await this.fetch(),
			color: "pink",
			icon: "reload"
		});

		this.actionMenu = new ContextMenu(this.actions);
		this.actionMenu
			.header({ title: app.string("select.none") })
			.add({ id: "delete", icon: "trash", text: app.string("action.delete"), color: "red" });

		this.actionMenu.onSelect(async (action) => {
			const instances = this.listTable.activeRows.map((i) => i.item);

			try {
				switch (action) {
					case "delete": {
						await this.bulkDelete(instances);
						break;
					}

					default:
						break;
				}
			} catch (e) {
				this.log("ERRR", `Handling actionMenu task [${action}] generated an error!`, e);
				errorHandler(e);
			}
		});

		this.actionMenu.onOpen((menu) => {
			const selected = this.listTable.activeRows.length;
			menu.disabled = (selected === 0);
			const header = (selected > 0)
				? app.string("select", { item: selected })
				: app.string("select.none");

			menu.header({ title: header });
		});

		this.actions.addEventListener("click", () => {
			if (this.actionMenu.showing)
				return;

			this.actionMenu.openAtElement(this.actions);
		});

		this.list = new ScreenPanel(this.screen, {
			title: app.string("model_user"),
			size: "full"
		});

		for (const field of this.fields) {
			this.headers[field] = {
				display: app.string(`table.${field}`),
				size: undefined
			};
		}

		this.listTable = new ScreenTable(this.list.content, {
			header: this.headers,
			builtInSort: false,
			empty: {
				title: app.string("model_empty_title", { model: this.name }),
				content: app.string("model_empty_content", { model: this.name }),
				buttons: [
					createButton(app.string("model_empty_create", { model: this.name }), {
						onClick: () => this.create()
					})
				]
			}
		});

		this.listTable.alwaysUpdate.name = true;

		this.listTable
			.setProcessor((name, value, instance) => this.processor(name, value, instance))
			.onActive((item) => this.info.view(item.item));

		this.listTable.setRowProcessor((item, row) => {
			/** @type {User} */
			const instance = item.item;

			const menu = new ContextMenu();
			menu.add({ id: "view", text: app.string("action.view") })
				.separator()
				.add({ id: "edit", text: app.string("action.edit"), icon: "pencil" })
				.add({ id: "delete", text: app.string("action.delete"), icon: "trash", color: "red" });

			menu.onSelect(async (id) => {
				switch (id) {
					case "view": {
						this.info.view(instance);
						break;
					}

					case "edit": {
						this.edit(instance);
						break;
					}

					case "delete": {
						await this.delete(instance);
						break;
					}

					default:
						break;
				}
			});

			row.addEventListener("contextmenu", (e) => {
				if (this.listTable.activeRows.length > 1) {
					// We are selecting multiple items, show the multiple select
					// menu instead of our own single instance menu.
					this.actionMenu.openByMouseEvent(e);
				} else {
					// We can now use our own single instance context menu.
					menu.openByMouseEvent(e);
				}
			});
		});

		this.createButton = createButton(app.string("button.create"), {
			icon: "plus",
			onClick: () => this.create()
		});

		this.list.addAction(this.reloadButton);
		this.list.addAction(this.createButton);
		this.list.addAction(this.actions);

		this.listPaging = new PagingBar(this.list.paging, { show: 9 });

		this.form = new ScreenForm({
			main: {
				name: app.string("form.group.main"),
				rows: [
					{
						username: {
							type: "text",
							label: app.string("table.username"),
							required: true
						},

						name: {
							type: "text",
							label: app.string("table.name"),
							required: true
						}
					},
					{
						email: {
							type: "email",
							label: app.string("table.email"),
							required: true
						},

						password: {
							type: "password",
							label: app.string("table.password"),
							required: true,

							options: {
								autofill: false
							}
						}
					}
				]
			},

			specification: {
				name: app.string("form.group.specification"),
				rows: [
					{
						isAdmin: {
							type: "checkbox",
							label: "Quản trị viên",
							default: false
						}
					}
				]
			}
		});

		this.list.onSearch((search) => {
			this.search = search;
			this.listPaging.setPage(1, true, true);
		});

		this.screen.onSideToggle((showing) => {
			if (!showing)
				this.form.show = false;
		});

		this.listTable.onSort((by, dir) => {
			this.sort.by = by;
			this.sort.dir = dir;
			this.fetch();
		});

		this.listPaging.onChange(() => this.fetch());
		this.screen.onActivate(() => this.fetch());
		this.reloadButton.addEventListener("click", () => this.fetch());
	},

	/**
	 * Create a new user.
	 */
	create() {
		let instance = new User();

		this.screen.showSide({
			title: app.string("model_creating", { model: this.name }),
			content: this.form.form
		});

		this.form.reset(true);
		this.form.title = app.string("model_creating", { model: this.name });

		this.form.items.username.disabled = false;
		this.form.items.password.input.required = true;
		this.form.items.password.label = app.string("table.password") + "*";

		setTimeout(() => {
			this.form.show = true;
		}, 200);

		this.form.onSubmit(async (values) => {
			for (let [name, value] of Object.entries(values))
				instance[name] = value;

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

			this.screen.alert("OKAY", app.string("model_created", { model: this.name, id: instance.id }));
			this.screen.hideSide();
			this.fetch();
		});
	},

	/**
	 * Start editing user
	 *
	 * @param   {User}     instance
	 */
	edit(instance) {
		this.screen.showSide({
			title: app.string("model_editing", { model: this.name, name: instance.name }),
			content: this.form.form
		});

		this.form.defaults = instance;
		this.form.reset();
		this.form.title = app.string("model_editing", { model: this.name, name: instance.name });

		this.form.items.username.disabled = true;
		this.form.items.password.input.required = false;
		this.form.items.password.label = app.string("user_password_optional");

		setTimeout(() => {
			this.form.show = true;
		}, 200);

		this.form.onSubmit(async (values) => {
			for (let [name, value] of Object.entries(values))
				instance[name] = value;

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

			this.screen.alert("OKAY", app.string("model_edited", { model: this.name, name: instance.name }));

			// Set new default and reload table.
			this.form.defaults = instance;
			this.fetch();
		});
	},

	/**
	 * Start deleting user operation
	 *
	 * @param   {User}	instance
	 */
	async delete(instance) {
		try {
			await instance.delete();

			this.fetch();
		} catch (e) {
			this.log("ERRR", "delete()", e);
			users.screen.handleError(e);
		}
	},

	/**
	 * Start deleting User operation
	 *
	 * @param	{User[]}	instances
	 */
	async bulkDelete(instances) {
		try {
			await Promise.all(instances.map((instance) => instance.delete()));
			this.fetch();
		} catch (e) {
			this.log("ERRR", "bulkDelete()", e);
			users.screen.handleError(e);
		}
	},

	async fetch() {
		if (this.fetching)
			return;

		this.fetching = true;
		this.listTable.loading = true;
		this.reloadButton.loading = true;
		let query = { page: this.listPaging.page, show: this.show };

		if (this.search)
			query.search = this.search;

		if (this.sort.by) {
			query.sort = this.sort.by;
			query.sortDir = this.sort.dir;
		}

		try {
			const response = await myajax({
				url: app.api(`/user/list`),
				method: "GET",
				query
			});

			const users = User.processResponses(response.data);

			if (users.length === 0) {
				if (this.search) {
					// Replace message with empty one.
					this.listTable.setMessage({
						title: app.string("model_search_empty_title", { query: escapeHTML(this.search) }),
						content: app.string("model_search_empty_content", { model: this.name })
					});
				} else {
					// Reset message to normal empty result.
					this.listTable.resetMessage();
				}
			}

			this.list.count = response.data.length;
			this.listPaging.max = 1;
			this.listTable.data = users;
		} catch (e) {
			// Let the table handle and display the error.
			this.listTable.handleError(e, [this.tryAgainButton]);
		}

		this.listTable.loading = false;
		this.reloadButton.loading = false;
		this.fetching = false;
	},

	/**
	 * View information of the provided User instance
	 *
	 * @param	{User}		instance
	 */
	async open(instance) {
		if (typeof instance !== "object")
			instance = await User.get(instance);

		this.list.search = `id=${instance.id}`;
		this.info.view(instance);

		if (!this.screen.activated)
			this.screen.activate();
	},

	/**
	 * Process table cell.
	 *
	 * @param   {String}    name
	 * @param   {any}       value
	 * @param   {User}      instance
	 */
	processor(name, value, instance) {
		let node = document.createElement("div");

		switch (name) {
			case "created":
			case "updated": {
				node.innerHTML = humanReadableTime(new Date(value * 1000), {
					beautify: true
				});

				break;
			}

			case "name":
				return instance.render({ link: false });

			case "lastAccess": {
				return (value > 0)
					? relativeTime(value, { returnNode: true })
					: ScreenUtils.renderStatus("WARN", app.string("status_never"));
			}

			default:
				node.innerText = value;
				break;
		}

		return node;
	},

	info: {
		/** @type {SQButton} */
		reload: undefined,

		/** @type {User} */
		instance: null,

		/** @type {ScreenTab} */
		tab: undefined,

		/** @type {ScreenInfoGrid} */
		grid: undefined,

		/** @type {ScreenTableBlock<Session>} */
		sessionTable: undefined,

		init() {
			this.tab = new ScreenTab(null, {
				sticky: true,
				spacing: true,
				fullHeight: true
			});

			this.sessionTable = new ScreenTableBlock({
				header: {
					id: { display: app.string("table.id") },
					sessionId: { display: app.string("table.sessionId") },
					expire: { display: app.string("table.expire") },
					status: { display: app.string("table.status") },
					ipAddress: { display: app.string("table.ipAddress") }
				},

				builtInSort: true,

				empty: {
					title: "Không có phiên",
					content: "Người dùng này chưa từng đăng nhập vào hệ thống."
				}
			});

			this.sessionTable.table.setProcessor((name, value, instance) => {
				switch (name) {
					case "status": {
						return (instance.expire >= time())
							? ScreenUtils.renderStatus("OKAY", "Phiên hiệu lực")
							: ScreenUtils.renderStatus("ERROR", "Phiên hết hạn");
					}
				}

				return null;
			});

			this.sessionTable.onFetch(async (search, page, sort, direction) => {
				const response = await myajax({
					url: app.api(`/user/${this.instance.id}/sessions`),
					method: "POST",
					query: { search, page, sort, sortDir: direction }
				});

				return {
					page: 1,
					maxPage: 1,
					total: response.data.length,
					data: Session.processResponses(response.data)
				}
			});

			this.grid = new ScreenInfoGrid(null, {
				info: {
					label: app.string("info"),
					items: [
						{
							label: app.string("table.id"),
							value: () => {
								return [
									ScreenUtils.renderLink(
										this.instance.id,
										() => users.open(this.instance.id)),

									this.instance.id
								];
							},

							copyable: true
						},
						{
							label: app.string("table.username"),
							value: () => this.instance.username,
							copyable: true
						},
						{
							label: app.string("table.name"),
							value: () => this.instance.name,
							copyable: true
						},
						{
							label: app.string("table.display"),
							value: () => this.instance.render()
						},
						{
							label: app.string("table.email"),
							value: () => this.instance.email,
							copyable: true
						},
						{
							label: app.string("table.isAdmin"),
							value: () => ScreenUtils.renderBoolean(this.instance.isAdmin)
						},
						{
							label: app.string("table.lastAccess"),
							value: () => {
								return (this.instance.lastAccess > 0)
									? ScreenUtils.renderDate(this.instance.lastAccess, true)
									: ScreenUtils.renderStatus("WARN", app.string("status_never"));
							}
						},
						{
							label: app.string("table.lastIP"),
							value: () => this.instance.lastIP,
							copyable: true
						},
						{
							label: app.string("table.created"),
							value: () => ScreenUtils.renderDate(this.instance.created, true)
						},
						{
							label: app.string("table.updated"),
							value: () => ScreenUtils.renderDate(this.instance.updated, true)
						}
					]
				},

				sessions: {
					label: "Phiên làm việc",
					node: this.sessionTable.container
				}
			}, { columns: 3 });

			this.tab.add({
				id: "info",
				title: app.string("tab.info"),
				content: this.grid.container
			});

			this.reload = createButton("", {
				icon: "reload",
				onClick: async () => await this.update()
			});
		},

		/**
		 * View group info
		 *
		 * @param   {User}   instance
		 */
		async view(instance) {
			users.screen.showSide({
				title: app.string("model_info", {
					model: app.string("table.user"),
					name: instance.name
				}),

				content: this.tab.container,
				actions: [this.reload]
			});

			this.instance = instance;
			await this.update();
		},

		async update() {
			await Promise.all([
				this.grid.update(),
				this.sessionTable.update()
			]);
		}
	}
}

// Regiser this screen to initialize when application load.
screens.users = users;
