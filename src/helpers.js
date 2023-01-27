"use strict";

const nodeInfo = ({ status, message }) => {
  status({ fill: "blue", shape: "dot", text: message });
};

const nodeError = ({ status, message }) => {
  status({ fill: "red", shape: "ring", text: message });
};

const nodeSuccess = ({ status, message }) => {
  status({ fill: "green", shape: "dot", text: message });

  resetNodeStatus({
    status,
    timeout: 1000,
  });
};

const resetNodeStatus = ({ status, timeout = 0 }) => {
  setTimeout(() => {
    status({});
  }, timeout);
};

module.exports = {
    resetNodeStatus,
  nodeInfo,
  nodeError,
  nodeSuccess,
};
