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
 * Vloom Dashboard screens.
 *
 * @package     vloom_core
 * @author      Brindley <brindley@videabiz.com>
 * @copyright   2023 Videa {@link https://videabiz.com}
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const screens = {
	/** @type {ScreenGroup} */
	system: undefined,

	/** @type {ScreenGroup} */
	automation: undefined,

	/** @type {ScreenGroup} */
	accounts: undefined,

	locationHash: undefined,

	called: false,

    init() {
		this.locationHash = location.hash;
		this.system = new ScreenGroup("system", app.string("system"));
		this.automation = new ScreenGroup("automation", "Tự động hóa");
		this.accounts = new ScreenGroup("accounts", "Tài khoản");
    },

	activate() {
		if (!app.initialized)
			return;

		if (!app.session)
			return;

		if (this.called)
			return;

		this.log("INFO", `Initializing app...`);
		websocket.connect();
		app.screen.activateByHash(this.locationHash);
		this.called = true;
	}
}
