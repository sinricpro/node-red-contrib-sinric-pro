"use strict";

const { API_ENDPOINT } = require("./config");
const ReconnectingWebSocket = require("./reconnecting-websocket");
const { nodeError, resetNodeStatus, nodeInfo } = require("./helpers");
const internalDebugLog = require("debug")("sinricpro:base");
const crypto = require("crypto");

class SinricProBaseNode {
  constructor({ self, node, RED }) {
    this.self = self;
    this.node = node;
    this.RED = RED;
    this.settings = node.settings ? RED.nodes.getNode(node.settings) : null;
    this.self.deviceId = node.deviceid;

    this.self.on("input", this.onInput.bind(this));
    this.self.on("close", this.onClose.bind(this));

    this.connectOnce(self, node);
  }

  infoStatus({ message, timeout }) {
    nodeInfo({ status: this.self.status.bind(this.self), message });
    if (timeout) this.hideNodeStatus(timeout);
  }

  errorStatus({ message, timeout }) {
    nodeError({ status: this.self.status.bind(this.self), message });
    if (timeout) this.hideNodeStatus(timeout);
  }

  hideNodeStatus(timeout) {
    return resetNodeStatus({
      status: this.self.status.bind(this.self),
      timeout: timeout,
    });
  }

  onClose() {
    internalDebugLog("[onClose()] closed!");
  }

  getUnixTime() {
    return (new Date().getTime() / 1000) | 0;
  }

  getSignature(message, appsecert) {
    return crypto
      .createHmac("sha256", appsecert)
      .update(message)
      .digest("base64");
  }

  getAppSecret() {
    let settingsNode;

    this.RED.nodes.eachNode((n) => {
      if (n.type === "settings") {
        settingsNode = this.RED.nodes.getNode(n.id);
      }
    });

    return settingsNode.appsecret;
  }

  onInput(msg) {
    internalDebugLog("[onInput()] input: ", msg);

    try {
      this.hideNodeStatus(0); // clear errors

      const action = msg.action;
      if (!action) {
        this.errorStatus({
          message: "Please provide an action name in msg.action",
        });
        return;
      }

      const deviceId = msg.deviceId;
      if (!deviceId) {
        this.errorStatus({
          message: "Please provide an deviceId name in msg.deviceId",
        });
        return;
      }

      const replyToken = msg.replyToken;
      if (!replyToken) {
        this.errorStatus({
          message: "Please provide an replyToken in msg.replyToken",
        });
        return;
      }

      const value = msg.value;
      if (!value) {
        this.errorStatus({ message: "Please provide an value in msg.value" });
        return;
      }

      const appsecret = this.getAppSecret();
      console.log("appsecret >", appsecret);

      const payload = {
        replyToken: replyToken,
        createdAt: this.getUnixTime(),
        deviceId: deviceId,
        type: "response",
        action: action,
        value: value,
      };

      const HMAC = this.getSignature(JSON.stringify(payload), appsecret);
      const signature = { HMAC: HMAC };
      const header = { payloadVersion: 2, signatureVersion: 1 };
      const reply = {
        header: header,
        payload: payload,
        signature: signature,
      };

      //console.log("this.websocket:", this.websocket);
      //this.websocket.send(reply);
    } catch (e) {
      internalDebugLog(e);
      this.errorStatus(e);
      return;
    }
  }

  connectOnce(self, node) {
    const connectionState =
      self.context().global.get("webScoketConnectionState") || 0;
    if (connectionState != 0 || !this.settings || !this.settings.appkey) {
      return;
    }

    self.context().global.set("webScoketConnectionState", 1);

    internalDebugLog(
      "[connectOnce()]: Connecting with AppKey: ",
      this.settings.appkey
    );

    const wsOptions = {
      headers: {
        appkey: this.settings.appkey,
        restoredevicestates: false,
      },
    };

    let client = new ReconnectingWebSocket(API_ENDPOINT, wsOptions);
    this.websocket = client;

    client.onopen = (event) => {
      node.connected = true;
      internalDebugLog("[connectOnce()]: Connected..!");
    };

    client.onclose = () => {
      node.connected = false;
      internalDebugLog("[connectOnce()]: Disconnected..!");
    };

    client.onmessage = (event) => {
      internalDebugLog("[connectOnce()]: < ", event.data);

      // ignore timestamp
      const isTimeStamp = event.data.indexOf("timestamp") == 2;
      if (isTimeStamp) return;

      const { payload } = JSON.parse(event.data);

      this.infoStatus({ message: `${payload.action}`, timeout: 1500 });

      if (payload.deviceId == this.self.deviceId) {
        // TODO: verify signature.
        self.send({ payload });
      }
    };
  }
}

module.exports = SinricProBaseNode;
