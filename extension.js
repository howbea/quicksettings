/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const children = Main.panel.statusArea.quickSettings._system._systemItem.child.get_children();
let settingsItem;
    for (const child of children) {
        if (child.constructor.name == "SettingsItem") {
                settingsItem = child;
        }
    }

export default class QuickSettingsExampleExtension extends Extension {
    _modifySystemItem() {        
        settingsItem.hide();
    }
    
   _queueModifySystemItem() {
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (!Main.panel.statusArea.quickSettings._system)
                return GLib.SOURCE_CONTINUE;

            this._modifySystemItem();
            return GLib.SOURCE_REMOVE;
        });
    }
    enable() {        
        if (Main.panel.statusArea.quickSettings._system)
                this._modifySystemItem();
            else
               this._queueModifySystemItem();
    }

    disable() {
        settingsItem.show();
    }
}
