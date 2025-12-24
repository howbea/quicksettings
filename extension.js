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

import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import UPower from 'gi://UPowerGlib';
import AccountsService from 'gi://AccountsService';

import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';
import {PopupAnimation} from 'resource:///org/gnome/shell/ui/boxpointer.js';
import {QuickSettingsItem, QuickToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {loadInterfaceXML} from 'resource:///org/gnome/shell/misc/fileUtils.js';
import * as userWidget from 'resource:///org/gnome/shell/ui/userWidget.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';

Gio._promisify(Gio.AppInfo, 'launch_default_for_uri_async');

const DisplayDeviceInterface = loadInterfaceXML('org.freedesktop.UPower.Device');
const PowerManagerProxy = Gio.DBusProxy.makeProxyWrapper(DisplayDeviceInterface);

const SHOW_BATTERY_PERCENTAGE = 'show-battery-percentage';

const children = Main.panel.statusArea.quickSettings._system._systemItem.child.get_children();
let settingsItem;
let shutdownItem;
let screenshotItem;
let lockItem;

    for (const child of children) {
        if (child.constructor.name == "SettingsItem") {
                settingsItem = child;
        }
    }
    
    for (const child of children) {
        if (child.constructor.name == "ShutdownItem") {
                shutdownItem = child;
        }
    }
    
    for (const child of children) {
        if (child.constructor.name == "ScreenshotItem") {
                screenshotItem = child;
        }
    }
    
    for (const child of children) {
        if (child.constructor.name == "LockItem") {
                lockItem = child;
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

const Example2Button = GObject.registerClass(
class Example2Button extends QuickSettings.QuickSettingsItem {
    _init() {
        super._init({
            style_class: 'icon-button',
            can_focus: true,
            icon_name: 'org.gnome.Settings-accessibility-symbolic',
            accessible_name: _('Example Action'),
        });

        this.connect('clicked', () => {
            Shell.AppSystem.get_default().lookup_app('gnome-universal-access-panel.desktop').activate(); //console.log('activated'));
            Main.panel.statusArea.quickSettings.menu.close();
            });
    }
});

const Example3Button = GObject.registerClass(
class Example3Button extends QuickSettings.QuickSettingsItem {
    _init() {
        super._init({
            style_class: 'icon-button',
            can_focus: true,
            icon_name: 'org.gnome.Settings-privacy-symbolic',
            accessible_name: _('Example Action'),
        });

        this.connect('clicked', () => {
            Shell.AppSystem.get_default().lookup_app('gnome-privacy-panel.desktop').activate(); //console.log('activated'));
            Main.panel.statusArea.quickSettings.menu.close();
            });
    }
});

const Example4Button = GObject.registerClass(
class Example4Button extends QuickSettings.QuickSettingsItem {
    _init() {
        super._init({
            style_class: 'icon-button',
            can_focus: true,
            icon_name: 'org.gnome.Settings-sharing-symbolic',
            accessible_name: _('Example Action'),
        });

        this.connect('clicked', () => {
            Shell.AppSystem.get_default().lookup_app('gnome-sharing-panel.desktop').activate(); //console.log('activated'));
            Main.panel.statusArea.quickSettings.menu.close();
            });
    }
});

const Example5Button = GObject.registerClass(
class Example5Button extends QuickSettings.QuickSettingsItem {
    _init() {
        super._init({
            style_class: 'icon-button',
            can_focus: true,
            icon_name: 'help-browser-symbolic',
            accessible_name: _('Example5 Action'),
        });

        this.connect('clicked', () => {
            if (Shell.AppSystem.get_default().lookup_app('yelp.desktop')) {
                Shell.AppSystem.get_default().lookup_app('yelp.desktop').activate();
            }
            else {
            Gio.AppInfo.launch_default_for_uri_async('https://discourse.gnome.org/', global.create_app_launch_context(0, -1), null)
            }
            Main.panel.closeQuickSettings();
            });
    }
});

const Example6Button = GObject.registerClass(
class Example6Button extends QuickSettings.SystemIndicator {
    _init() {
        super._init({
        style_class: 'system-status-icon'
        });
        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'start-here-symbolic';
    }
    destroy() {
        //this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
        }
});

const MenuSettingsItem = GObject.registerClass(
class MenuSettingsItem extends QuickSettingsItem {
    _init() {
        super._init({
        });

        this._settingItems = []; 

        Main.sessionMode.connectObject('updated', () => this._sync(), this);
        this._sync();
    }
    
    _addSystemAction(label, callback) {
        const item = shutdownItem.menu.addAction(label, callback);
        this._settingItems.push(item);
        }

    _sync() {
        this._settingItems.visible =
            this._settingItems != null && Main.sessionMode.allowSettings;
    }
});

export default class QuickSettingsExampleExtension extends Extension {
    _modifySystemItem() {        
        settingsItem.hide();
        shutdownItem.menu.removeAll();
        shutdownItem.menu._header.hide();        
        shutdownItem.icon_name = 'start-here1'; //'ubuntu-logo1'; //
        Main.panel.statusArea.quickSettings._system._indicator.icon_name = 'distributor-logo';
        
        this._systemActions = new SystemActions.getDefault();                
        
        //Main.panel.statusArea.quickSettings._indicators.remove_child(Main.panel.statusArea.quickSettings._system);
        //Main.panel.statusArea.quickSettings._indicators.insert_child_at_index(Main.panel.statusArea.quickSettings._system, 1);
        
        
        var userManager = AccountsService.UserManager.get_default();
        var user = userManager.get_user(GLib.get_user_name());        
        this._avatar = new userWidget.UserWidget(user);
        shutdownItem.menu.box.insert_child_at_index(this._avatar, 1);
        
        
        this._itemabout = new PopupMenu.PopupMenuItem(_('About'));
        this._itemabout.connect('activate', () => {
        Shell.AppSystem.get_default().lookup_app('gnome-system-panel.desktop').activate();
        Main.panel.closeQuickSettings();
        });
        
        this._itemsettings = new PopupMenu.PopupMenuItem(_('Settings'));
        this._itemsettings.connect('activate', () => {
        Shell.AppSystem.get_default().lookup_app('org.gnome.Settings.desktop').activate();
        Main.panel.closeQuickSettings();
        });        
        
        this._itemusers = new PopupMenu.PopupMenuItem(_('Account Settings'));
        this._itemusers.connect('activate', () => {
        Shell.AppSystem.get_default().lookup_app('gnome-users-panel.desktop').activate();
        Main.panel.closeQuickSettings();
        });
        
        this._itemsoftware = new PopupMenu.PopupMenuItem(_('Software Updates'));
        this._itemsoftware.connect('activate', () => {
        //Shell.AppSystem.get_default().lookup_app('org.gnome.Software.desktop').activate();
        Util.spawn(['gnome-software', '--mode=updates']);
        Main.panel.closeQuickSettings();
        });  
        
        this._itemhelp = new PopupMenu.PopupMenuItem(_('Help'));
        this._itemhelp.connect('activate', () => {
            if (Shell.AppSystem.get_default().lookup_app('yelp.desktop')) {
                Shell.AppSystem.get_default().lookup_app('yelp.desktop').activate();
            }
            else {
            Gio.AppInfo.launch_default_for_uri_async('https://discourse.gnome.org/', global.create_app_launch_context(0, -1), null)
            }
            Main.panel.closeQuickSettings();
        });
        
        this._settingItems = [this._itemabout, this._itemsettings, this._itemusers];
        
        shutdownItem.menu.addMenuItem(this._itemsettings);
        shutdownItem.menu.addMenuItem(this._itemsoftware);
        //shutdownItem.menu.addMenuItem(this._itemhelp);
        shutdownItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());      
        
        shutdownItem.menu.addMenuItem(this._itemabout);
        
        shutdownItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        shutdownItem._addSystemAction(_('Suspend'), 'can-suspend', () => {
            shutdownItem._systemActions.activateSuspend();
            Main.panel.closeQuickSettings();
        });

        shutdownItem._addSystemAction(_('Restart…'), 'can-restart', () => {
            shutdownItem._systemActions.activateRestart();
            Main.panel.closeQuickSettings();
        });

        shutdownItem._addSystemAction(_('Power Off'), 'can-power-off', () => {
            shutdownItem._systemActions.activatePowerOff();
            Main.panel.closeQuickSettings();
        });
        
        shutdownItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        shutdownItem._addSystemAction(_('Log Out…'), 'can-logout', () => {
            shutdownItem._systemActions.activateLogout();
            Main.panel.closeQuickSettings();
        });

        shutdownItem._addSystemAction(_('Switch User…'), 'can-switch-user', () => {
            shutdownItem._systemActions.activateSwitchUser();
            Main.panel.closeQuickSettings();
        });
        
        
        
        Main.sessionMode.connect('updated', () => {
            this._sync();
            });
        
        //shutdownItem.menu.box.insert_child_at_index(shutdownItem.menu._header, 0);
        //let shutdownItem.menu._header = new QuickToggleMenu._header;

        //shutdownItem.menu.headerLayout.hookup_style(shutdownItem.menu._header);
        /*shutdownItem.menu.box.add_child(new QuickSettings.QuickToggleMenu._header);
        shutdownItem.setHeader('start-here-symbolic', _('Example Title'),
            _('Optional Subtitle'));*/
        //shutdownItem = null;
        //screenshotItem.hide();
        this._button();
        
        this._indicator = new Example6Button(this);
        //Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator, 1);
        
        /*const myIndicator = new QuickSettings.SystemIndicator();
myIndicator.quickSettingsItems.push(new Example6Button());

Main.panel.statusArea.quickSettings.addExternalIndicator(myIndicator, 1);*/
    }
    
    _addSystemAction(label, callback) {
        const item = shutdownItem.menu.addAction(label, callback);
        this._settingItems.push(item);
        }

    _sync() {
        /*if (this._settingItems !=null && Main.sessionMode.allowSettings)
            this._settingItems.show();
        else
            this._settingItems.hide();*/
        if (this._itemabout != null && Main.sessionMode.allowSettings)
        this._itemabout.show();
        else
        this._itemabout.hide();
        
        if(this._itemsettings != null && Main.sessionMode.allowSettings)
        this._itemsettings.show();
        else
        this._itemsettings.hide();
        
        /*if(this._itemusers != null && Main.sessionMode.allowSettings)
        this._itemusers.show();
        else
        this._itemusers.hide();*/
        
        if (this._itemsoftware != null && Main.sessionMode.allowSettings)
        this._itemsoftware.show();
        else
        this._itemsoftware.hide();
    }    
    
    _button() {
    const quickSettingsMenu = Main.panel.statusArea.quickSettings;
    const quickSettingsActions = quickSettingsMenu._system._systemItem.child; //_indicator.child;

    this._E5Button = new Example5Button();
    
    //quickSettingsActions.insert_child_at_index(this._E6Button, 10);
    //quickSettingsActions.insert_child_at_index(this._E7Button, 3);
    //quickSettingsActions.insert_child_at_index(this._E4Button, 4);
    
    
    //shutdownItem.hide();
    //quickSettingsActions.remove_child(shutdownItem);
    //quickSettingsActions.insert_child_at_index(shutdownItem, 2);
    //quickSettingsActions.remove_child(lockItem);
    //quickSettingsActions.insert_child_at_index(lockItem, 5);
    quickSettingsActions.insert_child_at_index(this._E5Button, 4);
    
    
    //quickSettingsActions.remove_child(screenshotItem);
    //quickSettingsActions.insert_child_at_index(screenshotItem, 8);
    
    
    //quickSettingsMenu._system._systemItem.menu.destroy();
    //quickSettingsMenu._system._systemItem.menu = [this._E7Button, shutdownItem.menu];
    
    
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
        this._E5Button.destroy();
        this._E5Button = null;      
        this._avatar.destroy();
        this._avatar = null;
        
        if (Main.sessionMode.currentMode !== 'unlock-dialog'){
        settingsItem.show();
        //shutdownItem.show();
        //quickSettingsActions.remove_child(shutdownItem);
        }
    }
}
