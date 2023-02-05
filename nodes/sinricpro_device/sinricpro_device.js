/*
 *  Copyright (c) 2019-2023 Sinric. All rights reserved.
 *  Licensed under Creative Commons Attribution-Share Alike (CC BY-SA)
 *
 *  This file is part of the Sinric Pro (https://github.com/sinricpro/)
 */

"use strict";

const SinricProBaseNode = require("../../src/sinricpro-base-node");
const { nodeError } = require("../../src/helpers");

module.exports = (RED) => {
  function SinricProDeviceNode(node) {
    RED.nodes.createNode(this, node);

    if (!node.appcredential || !node.deviceid || !validConfig(RED, node)) {
      nodeError(node.status, "Invalid SinricPro config!", node);
      return;
    }

    // Set the appSecret for the flow.
    const appcredential = RED.nodes.getNode(node.appcredential);
    this.context().flow.set('appsecret', appcredential.appsecret);
 
    new SinricProBaseNode({
      self: this,
      node: node,
      RED: RED,
    });
  }

  RED.nodes.registerType("device", SinricProDeviceNode);
};

function validConfig(RED, node) {
  let appcredential = RED.nodes.getNode(node.appcredential);
  if (!appcredential.appkey || !appcredential.appsecret) {
    return false;
  }

  return true;
}

 