
const scenes = {
	/** @type {ScreenChild} */
	screen: undefined,

	init() {
		this.screen = new ScreenChild(
			screens.automation,
			"scenes",
			"Cảnh",
			{ noGrid: true }
		);
	},

	list: {
		/** @type {ScreenPanel} */
		panel: undefined,

		/** @type {ScreenTable<Scene>} */
		table: undefined,

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

		fetching: false,
		name: "",

		init() {
			this.name = app.string("table.scene");

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
				const instances = this.table.activeRows.map((i) => i.item);

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
				const selected = this.table.activeRows.length;
				const header = (selected > 0)
					? app.string("select", { item: selected })
					: app.string("select.none");

				menu.disabled = (selected === 0);
				menu.header({ title: header });
			});

			this.actions.addEventListener("click", () => {
				if (this.actionMenu.showing)
					return;

				this.actionMenu.openAtElement(this.actions);
			});

			this.panel = new ScreenPanel(scenes.screen, {
				title: "Các cảnh",
				size: "full"
			});

			this.table = new ScreenTable(this.panel.content, {
				header: {
					id: { display: app.string("table.id") },
					name: { display: app.string("table.name") },
					lastTrigger: { display: app.string("table.lastTrigger") }
				},

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

			this.table
				.setSort("id", { ascending: false, update: false })
				.setProcessor((name, value, instance) => this.processor(name, value, instance))
				.onActive((item) => scenes.info.view(item.item));

			this.table.setRowProcessor((item, row) => {
				const instance = item.item;

				const menu = new ContextMenu();
				menu.add({ id: "view", text: app.string("action.view") })
					.add({ id: "execute", text: app.string("action.execute"), icon: "play" })
					.separator()
					.add({ id: "edit", text: app.string("action.edit"), icon: "pencil" })
					.add({ id: "delete", text: app.string("action.delete"), icon: "trash", color: "red" });

				menu.onSelect(async (id) => {
					switch (id) {
						case "view": {
							scenes.info.view(instance);
							break;
						}

						case "execute": {
							await instance.execute();
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
					if (this.table.activeRows.length > 1) {
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

			this.panel.addAction(this.reloadButton);
			this.panel.addAction(this.createButton);
			this.panel.addAction(this.actions);

			this.listPaging = new PagingBar(this.panel.paging, { show: 9 });

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
						}
					]
				}
			});

			this.panel.onSearch((search) => {
				this.search = search;
				this.listPaging.setPage(1, true, true);
			});

			scenes.screen.onSideToggle((showing) => {
				if (!showing)
					this.form.show = false;
			});

			this.table.onSort(() => this.fetch());
			this.listPaging.onChange(() => this.fetch());
			scenes.screen.onActivate(() => this.fetch());
			this.reloadButton.addEventListener("click", () => this.fetch());
		},

		/**
		 * Create a new scene.
		 */
		create() {
			const instance = new Scene();

			scenes.screen.showSide({
				title: app.string("model_creating", { model: this.name }),
				content: this.form.form
			});

			this.form.reset(true);
			this.form.title = app.string("model_creating", { model: this.name });

			setTimeout(() => {
				this.form.show = true;
			}, 200);

			this.form.onSubmit(async (values) => {
				for (const [name, value] of Object.entries(values))
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

				scenes.screen.alert("OKAY", app.string("model_created", { model: this.name, id: instance.id }));
				scenes.screen.hideSide();
				this.fetch();
			});
		},

		/**
		 * Start editing scene.
		 *
		 * @param   {Scene}     instance
		 */
		edit(instance) {
			scenes.screen.showSide({
				title: app.string("model_editing", { model: this.name, name: instance.name }),
				content: this.form.form
			});

			this.form.defaults = instance;
			this.form.reset();
			this.form.title = app.string("model_editing", { model: this.name, name: instance.name });

			setTimeout(() => {
				this.form.show = true;
			}, 200);

			this.form.onSubmit(async (values) => {
				for (const [name, value] of Object.entries(values))
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

				scenes.screen.alert("OKAY", app.string("model_edited", { model: this.name, name: instance.name }));

				// Set new default and reload table.
				this.form.defaults = instance;
				this.fetch();
			});
		},

		/**
		 * Delete the selected scene
		 *
		 * @param   {Scene}	instance
		 */
		async delete(instance) {
			try {
				let deleted = await ModelFactory.delete("scene", instance, {
					name: this.name,
					prompt: `${instance.id}.${instance.shortname}`
				});

				if (deleted)
					this.fetch();
			} catch (e) {
				this.log("ERRR", "delete()", e);
				scenes.screen.handleError(e);
			}
		},

		/**
		 * Start deleting Scene operation
		 *
		 * @param	{Scene[]}		instances
		 */
		async bulkDelete(instances) {
			try {
				let deleted = await ModelFactory.bulkDelete(instances, {
					model: "scene",
					name: this.name,
					prompt: `scene.${instances.length}`
				});

				if (deleted)
					this.fetch();
			} catch (e) {
				this.log("ERRR", "bulkDelete()", e);
				scenes.screen.handleError(e);
			}
		},

		async fetch() {
			if (this.fetching)
				return;

			this.fetching = true;
			this.table.loading = true;
			this.reloadButton.loading = true;
			const query = { page: 1, show: 10 };

			if (this.search)
				query.search = this.search;

			if (this.table.sorts.key) {
				query.sort = this.table.sorts.key;
				query.sortDir = this.table.sorts.asc ? "asc" : "desc";
			}

			try {
				const response = await myajax({
					url: app.api("/scene/list"),
					method: "GET",
					query
				});

				const data = Scene.processResponses(response.data);

				if (data.length === 0) {
					if (this.search) {
						// Replace message with empty one.
						this.table.setMessage({
							title: app.string("model_search_empty_title", { query: escapeHTML(this.search) }),
							content: app.string("model_search_empty_content", { model: this.name })
						});
					} else {
						// Reset message to normal empty result.
						this.table.resetMessage();
					}
				}

				// this.panel.count = response.data.paging.total;
				// this.listPaging.max = response.data.paging.maxPage;
				this.table.data = data;
			} catch (e) {
				// Let the table handle and display the error.
				this.table.handleError(e, [this.tryAgainButton]);
			}

			this.table.loading = false;
			this.reloadButton.loading = false;
			this.fetching = false;
		},

		/**
		 * View information of the provided Scene instance
		 *
		 * @param	{Scene}	instance
		 */
		async open(instance) {
			if (typeof instance !== "object")
				instance = await Scene.get(instance);

			this.panel.search = `id=${instance.id}`;
			scenes.info.view(instance);

			if (!scenes.screen.activated)
				scenes.screen.activate();
		},

		/**
		 * Process table cell.
		 *
		 * @param	{string}		name
		 * @param	{any}			value
		 * @param	{Scene}		instance
		 */
		processor(name, value, instance) {
			const node = document.createElement("div");

			switch (name) {
				case "name": {
					return ScreenUtils.renderSpacedRow(
						ScreenUtils.renderIcon(instance.icon, { color: instance.color }),
						ScreenUtils.renderLink(value, () => {
							scenes.info.view(instance);
						}, { isExternal: false, color: instance.color })
					);
				}

				case "lastTrigger": {
					return (value)
						? relativeTime(value)
						: "Chưa được chạy";
				}

				case "created":
				case "updated":
					return ScreenUtils.renderDate(value);

				default:
					node.innerText = value;
					break;
			}

			return node;
		}
	},

	info: {
		/** @type {HTMLElement} */
		container: undefined,

		/** @type {SQButton} */
		
		reload: undefined,
		/** @type {Scene} */
		instance: null,

		/** @type {ScreenInfoGrid} */
		grid: undefined,

		/** @type {TreeDOM} */
		actionView: undefined,

		/** @type {TreeDOM} */
		actionEmpty: undefined,

		/** @type {SQButton} */
		actionReload: undefined,

		/** @type {SQButton} */
		actionCreate: undefined,

		/** @type {SQButton} */
		actionEmptyCreate: undefined,

		/** @type {SQButton} */
		actionExecute: undefined,
		
		/** @type {SceneAction[]} */
		actions: [],

		init() {
			this.container = document.createElement("div");
			this.container.classList.add("screen-info");

			this.actionReload = createButton("", {
				icon: "reload",
				color: "blue",
				onClick: () => this.updateActions()
			});

			this.actionCreate = createButton("Thêm", {
				icon: "plus",
				color: "accent",
				onClick: () => this.createAction()
			});

			this.actionEmptyCreate = createButton("Thêm hành động mới", {
				icon: "plus",
				color: "accent",
				onClick: () => this.createAction()
			});

			this.actionExecute = createButton("Chạy", {
				icon: "play",
				color: "green",
				onClick: () => this.instance.execute()
			});

			this.actionEmpty = makeTree("div", "empty-message", {
				message: { tag: "div", class: "message", text: "Hiện chưa có hành động nào" },
				content: { tag: "div", class: "content", text: "Các hành động sẽ được thực thi khi các điều kiện được thỏa mãn." },
				actions: { tag: "div", class: "actions", child: {
					create: this.actionEmptyCreate
				}}
			});

			this.actionView = makeTree("div", "list-editor-block", {
				header: { tag: "div", class: "header", child: {
					titl: { tag: "span", class: "title", child: {
						content: { tag: "div", class: "content", text: "Hành động" }
					}},

					actions: { tag: "span", class: "actions", child: {
						execute: this.actionExecute,

						g1: ScreenUtils.buttonGroup(
							this.actionCreate,
							this.actionReload
						)
					}}
				}},

				editor: { tag: "div", class: "editor", child: {
					empty: this.actionEmpty
				}}
			});

			this.grid = new ScreenInfoGrid(this.container, {
				info: {
					label: app.string("info"),
					items: [
						{
							label: app.string("table.id"),
							value: () => this.instance.id,
							copyable: true
						},
						{
							label: app.string("table.name"),
							value: () => this.instance.name,
							copyable: true
						},
						{
							label: app.string("table.lastTrigger"),
							value: () => (this.instance.lastTrigger)
								? relativeTime(this.instance.lastTrigger)
								: "Chưa được chạy"
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

				specification: {
					label: app.string("specification"),
					items: [
						{
							label: app.string("table.icon"),
							value: () => [
								ScreenUtils.renderSpacedRow(
									ScreenUtils.renderIcon(this.instance.icon),
									this.instance.icon
								),
								this.instance.icon
							],

							copyable: true
						},
						{
							label: app.string("table.color"),
							value: () => [
								ScreenUtils.renderBadge(app.string(`color.${this.instance.color}`), this.instance.color),
								this.instance.color
							],

							copyable: true
						}
					]
				},

				actions: {
					label: app.string("actions"),
					node: this.actionView,
					headerLine: false
				}
			}, { columns: 3 });

			this.reload = createButton("", {
				icon: "reload",
				onClick: async () => await this.grid.update()
			});
		},

		/**
		 * View scene info
		 *
		 * @param	{Scene}	instance
		 */
		async view(instance) {
			scenes.screen.showSide({
				title: app.string("model_info", { model: app.string("table.scene"), name: instance.name }),
				content: this.container,
				actions: [this.reload]
			});

			this.instance = instance;

			await Promise.all([
				this.grid.update(),
				this.updateActions()
			]);
		},

		async updateActions() {
			this.actionReload.loading = true;

			try {
				const response = await myajax({
					url: app.api(`/scene/${this.instance.id}/action`),
					method: "GET"
				});

				this.actions = await SceneAction.processResponses(response.data);
				this.renderActions();
			} catch (e) {
				scenes.screen.handleError(e);
			}
			
			this.actionReload.loading = false;
		},

		renderActions() {
			emptyNode(this.actionView.editor);

			if (this.actions.length === 0) {
				this.actionView.editor.appendChild(this.actionEmpty);
				return;
			}

			for (const item of this.actions) {
				this.actionView.editor.appendChild(item.render());
			}
		},

		async createAction() {
			const instance = new SceneAction(null);
			instance.scene = this.instance;
			instance.action = "setValue";

			this.actions.push(instance);
			this.renderActions();
			return instance;
		}
	}
}

// Regiser this screen to initialize when application load.
screens.scenes = scenes;
