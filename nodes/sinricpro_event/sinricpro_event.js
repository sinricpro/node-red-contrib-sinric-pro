"use strict";

const SinricProBaseNode = require("../../src/sinricpro-base-node");

module.exports = (RED) => {
  function SinricProEventNode(node) {
    RED.nodes.createNode(this, node);

    new SinricProBaseNode({
      self: this,
      node: node,
      RED: RED,
      nodeType: 'eventNode'
    });
  }

  RED.nodes.registerType("event", SinricProEventNode);
};
