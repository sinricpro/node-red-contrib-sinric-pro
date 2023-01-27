"use strict";

const SinricProBaseNode = require("../../src/sinricpro-base-node");
const { nodeError } = require("../../src/helpers");

module.exports = (RED) => {
  function SinricProDeviceNode(node) {
    RED.nodes.createNode(this, node);

    if (!node.settings || !node.deviceid || !validConfig(RED, node)) {
      nodeError(node.status, "Invalid SinricPro config!", node);
      return;
    }
   
    new SinricProBaseNode({
      self: this,
      node: node,
      RED: RED,
    });
  }

  RED.nodes.registerType("device", SinricProDeviceNode);
};

function validConfig(RED, node) {
  let settings = RED.nodes.getNode(node.settings);
  if (!settings.appkey || !settings.appsecret) {
    return false;
  }

  return true;
}
