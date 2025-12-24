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
import Graphene from 'gi://Graphene';

import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';
import {PopupAnimation} from 'resource:///org/gnome/shell/ui/boxpointer.js';
import {QuickSettingsItem, QuickToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {loadInterfaceXML} from 'resource:///org/gnome/shell/misc/fileUtils.js';
import * as userWidget from 'resource:///org/gnome/shell/ui/userWidget.js';
import * as system from 'resource:///org/gnome/shell/ui/status/system.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import * as DoNotDisturb from 'resource:///org/gnome/shell/ui/status/doNotDisturb.js';

Gio._promisify(Gio.AppInfo, 'launch_default_for_uri_async');

const DisplayDeviceInterface = loadInterfaceXML('org.freedesktop.UPower.Device');
const PowerManagerProxy = Gio.DBusProxy.makeProxyWrapper(DisplayDeviceInterface);

const SHOW_BATTERY_PERCENTAGE = 'show-battery-percentage';

const INACTIVE_WORKSPACE_DOT_SCALE = 0.75;

const WorkspaceDot = GObject.registerClass({
    Properties: {
        'expansion': GObject.ParamSpec.double('expansion', null, null,
            GObject.ParamFlags.READWRITE,
            0.0, 1.0, 0.0),
        'width-multiplier': GObject.ParamSpec.double(
            'width-multiplier', null, null,
            GObject.ParamFlags.READWRITE,
            1.0, 10.0, 1.0),
    },
}, class WorkspaceDot extends Clutter.Actor {
    constructor(params = {}) {
        super({
            pivot_point: new Graphene.Point({x: 0.5, y: 0.5}),
            ...params,
        });

        this._dot = new St.Widget({
            style_class: 'workspace-dot',
            y_align: Clutter.ActorAlign.CENTER,
            pivot_point: new Graphene.Point({x: 0.5, y: 0.5}),
            request_mode: Clutter.RequestMode.WIDTH_FOR_HEIGHT,
        });
        this.add_child(this._dot);

        this.connect('notify::width-multiplier', () => this.queue_relayout());
        this.connect('notify::expansion', () => {
            this._updateVisuals();
            this.queue_relayout();
        });
        this._updateVisuals();

        this._destroying = false;
    }

    _updateVisuals() {
        const {expansion} = this;

        this._dot.set({
            opacity: Util.lerp(0.50, 1.0, expansion) * 255,
            scaleX: Util.lerp(INACTIVE_WORKSPACE_DOT_SCALE, 1.0, expansion),
            scaleY: Util.lerp(INACTIVE_WORKSPACE_DOT_SCALE, 1.0, expansion),
        });
    }

    vfunc_get_preferred_width(forHeight) {
        const factor = Util.lerp(1.0, this.widthMultiplier, this.expansion);
        return this._dot.get_preferred_width(forHeight).map(v => Math.round(v * factor));
    }

    vfunc_get_preferred_height(forWidth) {
        return this._dot.get_preferred_height(forWidth);
    }

    vfunc_allocate(box) {
        this.set_allocation(box);

        box.set_origin(0, 0);
        this._dot.allocate(box);
    }

    scaleIn() {
        this.set({
            scale_x: 0,
            scale_y: 0,
        });

        this.ease({
            duration: 500,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            scale_x: 1.0,
            scale_y: 1.0,
        });
    }

    scaleOutAndDestroy() {
        this._destroying = true;

        this.ease({
            duration: 500,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            scale_x: 0.0,
            scale_y: 0.0,
            onComplete: () => this.destroy(),
        });
    }

    get destroying() {
        return this._destroying;
    }
});

const WorkspaceIndicators = GObject.registerClass(
class WorkspaceIndicators extends St.BoxLayout {
    constructor() {
        super();

        this._workspacesAdjustment = Main.createWorkspacesAdjustment(this);
        this._workspacesAdjustment.connectObject(
            'notify::value', () => this._updateExpansion(),
            'notify::upper', () => this._recalculateDots(),
            this);

        for (let i = 0; i < this._workspacesAdjustment.upper; i++)
            this.insert_child_at_index(new WorkspaceDot(), i);
        this._updateExpansion();
    }

    _getActiveIndicators() {
        return [...this].filter(i => !i.destroying);
    }

    _recalculateDots() {
        const activeIndicators = this._getActiveIndicators();
        const nIndicators = activeIndicators.length;
        const targetIndicators = this._workspacesAdjustment.upper;

        let remaining = Math.abs(nIndicators - targetIndicators);
        while (remaining--) {
            if (nIndicators < targetIndicators) {
                const indicator = new WorkspaceDot();
                this.add_child(indicator);
                indicator.scaleIn();
            } else {
                const indicator = activeIndicators[nIndicators - remaining - 1];
                indicator.scaleOutAndDestroy();
            }
        }

        this._updateExpansion();
    }

    _updateExpansion() {
        const nIndicators = this._getActiveIndicators().length;
        const activeWorkspace = this._workspacesAdjustment.value;

        let widthMultiplier;
        if (nIndicators <= 2)
            widthMultiplier = 3.625;
        else if (nIndicators <= 5)
            widthMultiplier = 3.25;
        else
            widthMultiplier = 2.75;

        this.get_children().forEach((indicator, index) => {
            const distance = Math.abs(index - activeWorkspace);
            indicator.expansion = Math.clamp(1 - distance, 0, 1);
            indicator.widthMultiplier = widthMultiplier;
        });
    }
});

/*const ActivitiesButton = GObject.registerClass(
class ActivitiesButton extends PanelMenu.Button {
    _init() {
        super._init(0.0, null, true);

        this.set({
            name: 'panelActivities',
            accessible_role: Atk.Role.TOGGLE_BUTTON,
            /* Translators: If there is no suitable word for "Activities"
               in your language, you can use the word for "Overview". */
/*            accessible_name: _('Activities'),
        });

        this.add_child(new WorkspaceIndicators());

        Main.overview.connectObject('showing',
            () => this.add_style_pseudo_class('checked'),
            this);
        Main.overview.connectObject('hiding',
            () => this.remove_style_pseudo_class('checked'),
            this);

        this._xdndTimeOut = 0;
    }

    handleDragOver(source, _actor, _x, _y, _time) {
        if (source !== Main.xdndHandler)
            return DND.DragMotionResult.CONTINUE;

        if (this._xdndTimeOut !== 0)
            GLib.source_remove(this._xdndTimeOut);
        this._xdndTimeOut = GLib.timeout_add(GLib.PRIORITY_DEFAULT, BUTTON_DND_ACTIVATION_TIMEOUT, () => {
            this._xdndToggleOverview();
        });
        GLib.Source.set_name_by_id(this._xdndTimeOut, '[gnome-shell] this._xdndToggleOverview');

        return DND.DragMotionResult.CONTINUE;
    }

    vfunc_event(event) {
        if (event.type() === Clutter.EventType.TOUCH_END ||
            event.type() === Clutter.EventType.BUTTON_RELEASE) {
            if (Main.overview.shouldToggleByCornerOrButton())
                Main.overview.toggle();
        }

        return Main.wm.handleWorkspaceScroll(event);
    }

    vfunc_key_release_event(event) {
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_space) {
            if (Main.overview.shouldToggleByCornerOrButton()) {
                Main.overview.toggle();
                return Clutter.EVENT_STOP;
            }
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _xdndToggleOverview() {
        let [x, y] = global.get_pointer();
        let pickedActor = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);

        if (pickedActor === this && Main.overview.shouldToggleByCornerOrButton())
            Main.overview.toggle();

        GLib.source_remove(this._xdndTimeOut);
        this._xdndTimeOut = 0;
        return GLib.SOURCE_REMOVE;
    }
});*/

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
    
const WellbeingButton = GObject.registerClass(
class WellbeingButton extends QuickSettings.QuickSettingsItem {
    _init() {
        super._init({
            style_class: 'icon-button',
            can_focus: true,
            icon_name: 'org.gnome.Settings-wellbeing-symbolic',
            accessible_name: _('Wellbeing Action'),
        });

        this.connect('clicked', () => {
            Shell.AppSystem.get_default().lookup_app('gnome-wellbeing-panel.desktop').activate(); //console.log('activated'));
            Main.panel.statusArea.quickSettings.menu.close();
            });
    }
});

const DisplaysButton = GObject.registerClass(
class DisplaysButton extends QuickSettings.QuickSettingsItem {
    _init() {
        super._init({
            style_class: 'icon-button',
            can_focus: true,
            icon_name: 'org.gnome.Settings-display-symbolic',
            accessible_name: _('Wellbeing Action'),
        });

        this.connect('clicked', () => {
            Shell.AppSystem.get_default().lookup_app('gnome-display-panel.desktop').activate(); //console.log('activated'));
            Main.panel.statusArea.quickSettings.menu.close();
            });
    }
});

const AppearanceButton = GObject.registerClass(
class AppearanceButton extends QuickSettings.QuickSettingsItem {
    _init() {
        super._init({
            style_class: 'icon-button',
            can_focus: true,
            icon_name: 'org.gnome.Settings-appearance-symbolic',
            accessible_name: _('Appearance Action'),
        });

        this.connect('clicked', () => {
            Shell.AppSystem.get_default().lookup_app('gnome-background-panel.desktop').activate(); //console.log('activated'));
            Main.panel.statusArea.quickSettings.menu.close();
            });
    }
});

const UsersButton = GObject.registerClass(
class UsersButton extends QuickSettings.QuickSettingsItem {
    _init() {
        super._init({
            style_class: 'icon-button',
            can_focus: true,
            icon_name: 'org.gnome.Settings-users-symbolic',
            accessible_name: _('Users Action'),
        });

        this.connect('clicked', () => {
            Shell.AppSystem.get_default().lookup_app('gnome-users-panel.desktop').activate(); //console.log('activated'));
            Main.panel.statusArea.quickSettings.menu.close();
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
        this._indicator.icon_name = 'org.gnome.Settings-search-symbolic';
    }
    
    vfunc_event(event) {
        if (event.type() === Clutter.EventType.TOUCH_END ||
            event.type() === Clutter.EventType.BUTTON_RELEASE) {
            return Clutter.EVENT_PROPAGATE;
        }
        return Main.wm.handleWorkspaceScroll(event);        
    }
    
    destroy() {
        super.destroy();
        }
});

const NotificationsIndicator = GObject.registerClass(
class NotificationsIndicator extends QuickSettings.SystemIndicator {
    _init() {
        super._init({
        style_class: 'system-status-icon'
        });
        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'org.gnome.Settings-notifications-symbolic';
        //this._indicator.visible = false;
        
        this._settings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.notifications',
        });
        
        this._show_indicator = this._settings.get_boolean('show-banners');
        
        if(this._show_indicator)
            this._indicator.visible = true;
        else
            this._indicator.visible = false;
            
        this._settings.connect("changed", () => {
        this._show_indicator = this._settings.get_boolean('show-banners');
          if(this._show_indicator)
            this._indicator.visible = true;
        else
            this._indicator.visible = false;
            });
    }
    
    destroy() {
        super.destroy();
        }
});

//export const Indicator = GObject.registerClass(
const BatteryIndicator = GObject.registerClass(
class BatteryIndicator extends SystemIndicator {
    _init() {
        super._init();

        this._desktopSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.interface',
        });
        this._desktopSettings.connectObject(
            `changed::${SHOW_BATTERY_PERCENTAGE}`, () => this._sync(), this);

        this._indicator = this._addIndicator();
        this._percentageLabel = new St.Label({
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._percentageLabel);
        this.add_style_class_name('power-status');

        this._systemItem = Main.panel.statusArea.quickSettings._system._systemItem; //new SystemItem();

        const {powerToggle} = this._systemItem;

        powerToggle.bind_property('title',
            this._percentageLabel, 'text',
            GObject.BindingFlags.SYNC_CREATE);

        powerToggle.connectObject(
            'notify::visible', () => this._sync(),
            'notify::gicon', () => this._sync(),
            'notify::fallback-icon-name', () => this._sync(),
            this);

        //this.quickSettingsItems.push(this._systemItem);

        this._sync();
    }
    
    /*vfunc_event(event) {
        if (event.type() === Clutter.EventType.TOUCH_END ||
            event.type() === Clutter.EventType.BUTTON_RELEASE) {
            return Clutter.EVENT_PROPAGATE;
        }
        return Main.wm.handleWorkspaceScroll(event);        
    }*/

    _sync() {
        if(!this.visible)
        this.visible = true;
        const {powerToggle} = this._systemItem;
        if (powerToggle.visible) {
            this._indicator.set({
                gicon: powerToggle.gicon,
                fallback_icon_name: powerToggle.fallback_icon_name,
            });
            this._percentageLabel.visible =
                this._desktopSettings.get_boolean(SHOW_BATTERY_PERCENTAGE);
        } else {
            // If there's no battery, then we use the power icon.
            this._indicator.icon_name = ''; //'system-shutdown-symbolic';
            this._percentageLabel.hide();
            this.visible = false;
        }
    }
});

export default class QuickSettingsExampleExtension extends Extension {
    _modifySystemItem() {        
        settingsItem.hide();
        shutdownItem.hide();
        screenshotItem.hide();
        lockItem.hide();
        //this._button();
        Main.panel.statusArea.quickSettings._doNotDisturb.hide();
        Main.panel.statusArea.quickSettings._doNotDisturb._indicator.connect('notify::visible', ()=> {
                Main.panel.statusArea.quickSettings._doNotDisturb.hide();
                });
        //Main.panel.statusArea.quickSettings._indicators.remove_child(Main.panel.statusArea.quickSettings._doNotDisturb);
        this._doNotDisturb = new DoNotDisturb.Indicator();
        Main.panel.statusArea.quickSettings._indicators.add_child(this._doNotDisturb);
        this._notificationsIndicator = new NotificationsIndicator();
        Main.panel.statusArea.quickSettings._indicators.add_child(this._notificationsIndicator);
        Main.panel.statusArea.quickSettings._system.hide(); //_indicator.hide();
        this._batteryIndicator = new BatteryIndicator();
        Main.panel.statusArea.quickSettings._indicators.add_child(this._batteryIndicator);
    }
    
    _button() {
    const quickSettingsMenu = Main.panel.statusArea.quickSettings;
    const quickSettingsActions = quickSettingsMenu._system._systemItem.child; //_indicator.child;
    this._wellbeingButton = new WellbeingButton();
    quickSettingsActions.add_child(this._wellbeingButton);
     //this._displaysButton = new DisplaysButton();
     //quickSettingsActions.add_child(this._displaysButton);
     this._appearanceButton = new AppearanceButton();
     quickSettingsActions.add_child(this._appearanceButton);
     this._usersButton = new UsersButton();
     quickSettingsActions.add_child(this._usersButton);
    }
    
   _queueModifySystemItem() {
        GLib.idle_add(GLib.PRIORI_TY_DEFAULT, () => {
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
        shutdownItem.show();
        settingsItem.show();
        screenshotItem.show();
        lockItem.show();
        Main.panel.statusArea.quickSettings._doNotDisturb.show();
        Main.panel.statusArea.quickSettings._system.show(); //_indicator.show();
        this._doNotDisturb.destroy();
        this._notificationsIndicator.destroy();
        this._batteryIndicator.destroy();
        /*if (this._wellbeingButton)
        this._wellbeingButton.destroy();
        this._wellbeingButton = null;
        if (this._appearanceButton)
        this._appearanceButton.destroy();
        this._appearanceButton = null;
        if (this._usersButton)
        this._usersButton.destroy();
        this._usersButton = null;*/
    }
}
