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
	/** @type {ScreenChild} */
	screen: undefined,

	init() {
		this.screen = new ScreenChild(
			screens.system,
			"dashboard",
			app.string("system_dashboard"),
			{
				title: app.string("system_dashboard_title"),
				activated: true
			}
		);
	}
}

// Regiser this screen to initialize when application load.
screens.dashboard = dashboard;
