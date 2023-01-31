/*
 *  Copyright (c) 2019-2023 Sinric. All rights reserved.
 *  Licensed under Creative Commons Attribution-Share Alike (CC BY-SA)
 *
 *  This file is part of the Sinric Pro (https://github.com/sinricpro/)
 */

'use strict';

const SinricProBaseNode = require("../../src/sinricpro-base-node");

module.exports = (RED) => {
  function SinricProResponseNode(node) {
    RED.nodes.createNode(this, node);

    new SinricProBaseNode({
      self: this,
      node: node,
      RED: RED,
      nodeType: 'responseNode'
    });
  }

  RED.nodes.registerType("response", SinricProResponseNode);
};
