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

import Shell from 'gi://Shell'; 
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import AccountsService from 'gi://AccountsService';
import GLib from 'gi://GLib';

import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as userWidget from 'resource:///org/gnome/shell/ui/userWidget.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const children = Main.panel.statusArea.quickSettings._system._systemItem.child.get_children();
let settingsItem;
let shutdownItem;

    for (const child of children) {
        if (child.constructor.name == "SettingsItem") {
                settingsItem = child;
        }
        else if (child.constructor.name == "ShutdownItem") {
                shutdownItem = child;
        }
    }
    
const ExampleButton = GObject.registerClass(
class ExampleButton extends QuickSettings.QuickSettingsItem {
    _init() {
        super._init({
            style_class: 'icon-button',
            can_focus: true,
            icon_name: 'org.gnome.Settings-wellbeing-symbolic',
            accessible_name: _('Example Action'),
        });

        this.connect('clicked', () => {
            Shell.AppSystem.get_default().lookup_app('gnome-wellbeing-panel.desktop').activate(); //console.log('activated'));
            Main.panel.statusArea.quickSettings.menu.close();
            });
    }
});

export default class QuickSettingsExampleExtension extends Extension {
    _modifySystemItem() {        
        settingsItem.hide();
        this._button();
        this._userheader();
        this._addmenu();
    }
    
    _userheader() {
        var userManager = AccountsService.UserManager.get_default();
        var user = userManager.get_user(GLib.get_user_name());
        this._avatar = new userWidget.UserWidget(user);
        
        shutdownItem.menu._header.hide();
        shutdownItem.menu.box.insert_child_at_index(this._avatar, 1);
    }
    
    _addmenu() {

        let itemhelp = new PopupMenu.PopupMenuItem(_('Help'));
        itemhelp.connect('activate', () => {
        Gio.AppInfo.launch_default_for_uri_async('https://www.debian.org/support', global.create_app_launch_context(0, -1), null)
        //Shell.AppSystem.get_default().lookup_app('yelp.desktop').activate();
        Main.panel.closeQuickSettings();
        }); 
        
        let itemsettings = new PopupMenu.PopupMenuItem(_('Settings / Updates...'));
        itemsettings.connect('activate', () => {
        Shell.AppSystem.get_default().lookup_app('gnome-system-panel.desktop').activate();
        Main.panel.closeQuickSettings();
        });        
        
        let itemabout = new PopupMenu.PopupMenuItem(_('About'));
        itemabout.connect('activate', () => {
        Shell.AppSystem.get_default().lookup_app('gnome-about-panel.desktop').activate();
        Main.panel.closeQuickSettings();
        });
        
        let itemusers = new PopupMenu.PopupMenuItem(_('User Settings'));
        itemusers.connect('activate', () => {
        Shell.AppSystem.get_default().lookup_app('gnome-users-panel.desktop').activate();
        Main.panel.closeQuickSettings();
        });        
        
        shutdownItem.icon_name = 'start-here-symbolic';
        
        shutdownItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), 0);        
        shutdownItem.menu.addMenuItem(itemhelp, 0);        
        shutdownItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), 0);        
        shutdownItem.menu.addMenuItem(itemsettings, 0);        
        shutdownItem.menu.addMenuItem(itemabout, 0);        
        shutdownItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(), 0);
        shutdownItem.menu.addMenuItem(itemusers, 0);
        
    }
    
    _button() {
    const quickSettingsMenu = Main.panel.statusArea.quickSettings;
    const quickSettingsActions = quickSettingsMenu._system._systemItem.child; //_indicator.child;
    this._EButton = new ExampleButton();
    quickSettingsActions.insert_child_at_index(this._EButton, 3);
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
        this._EButton.destroy();
        this._EButton = null;
        if (Main.sessionMode.currentMode !== 'unlock-dialog')
        settingsItem.show();
        this._avatar.destroy();
        this._avatar = null;
    }
}
