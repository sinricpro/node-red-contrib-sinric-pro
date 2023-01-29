/*
 *  Copyright (c) 2019-2023 Sinric. All rights reserved.
 *  Licensed under Creative Commons Attribution-Share Alike (CC BY-SA)
 *
 *  This file is part of the Sinric Pro (https://github.com/sinricpro/)
 */

"use strict";

module.exports = function (RED) {
  function SettingsNode(n) {
    RED.nodes.createNode(this, n);
    this.appkey = n.appkey;
    this.appsecret = n.appsecret;
  }
  RED.nodes.registerType("settings", SettingsNode);
};
