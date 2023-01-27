"use strict";

const SinricProBaseNode = require("../../src/sinricpro-base-node");

module.exports = (RED) => {
  function SinricProReplyNode(node) {
    RED.nodes.createNode(this, node);

    new SinricProBaseNode({
      self: this,
      node: node,
      RED: RED,
    });
  }

  RED.nodes.registerType("reply", SinricProReplyNode);
};
