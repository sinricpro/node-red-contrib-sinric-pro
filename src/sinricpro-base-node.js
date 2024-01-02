/*
 *  Copyright (c) 2019-2023 Sinric. All rights reserved.
 *  Licensed under Creative Commons Attribution-Share Alike (CC BY-SA)
 *
 *  This file is part of the Sinric Pro (https://github.com/sinricpro/)
 */

"use strict";

const { API_ENDPOINT } = require("./config");
const ReconnectingWebSocket = require("./reconnecting-websocket");
const { nodeError, resetNodeStatus, nodeInfo } = require("./helpers");
const internalDebugLog = require("debug")("sinricpro:base");
const crypto = require("crypto");
const FastRateLimit = require("fast-ratelimit").FastRateLimit;
const moment = require('moment');
const pjson = require('./../package.json');
const flowDeviceMap = new Map();

class SinricProBaseNode {
  constructor({ self, node, RED, nodeType }) {
    this.self = self;
    this.node = node;
    this.RED = RED;
    this.nodeType = nodeType;
    this.appcredential = node.appcredential ? RED.nodes.getNode(node.appcredential) : null;
    this.self.deviceId = node.deviceid;
    this.self.on("close", this.onClose.bind(this));
    this.self.on("input", this.onInput.bind(this));

    // Setup nodes
    if(nodeType == 'eventNode') {
      // Setup message rate limit for events
      this.limiter = new FastRateLimit({
        threshold : 60,
        ttl : 60 
      }); 
    }

    this.connectOnce(self, node);
  }

  /**
   * Shows info message on the node.
   *
   * @param message message.
   * @param timeout message visible duration.
   */
  infoStatus({ message, timeout, node }) {
    const nodeHost = node ?? this.self;
    nodeInfo({ status: nodeHost.status.bind(nodeHost), message });
    if (timeout) this.hideNodeStatus(timeout, node);
  }

  /**
   * Shows error message on the node.
   *
   * @param message message.
   * @param timeout message visible duration.
   */
  errorStatus({ message, timeout, node }) {
    const nodeHost = node ?? this.self;
    nodeError({ status: nodeHost.status.bind(nodeHost), message });
    if (timeout) this.hideNodeStatus(timeout);
  }

  /**
   * Hide any notifications on the node.
   *
   * @param message message.
   * @param timeout message visible duration.
   */
  hideNodeStatus(timeout, target) {
    const nodeHost = target ?? this.self;
    return resetNodeStatus({
      status: nodeHost.status.bind(nodeHost),
      timeout: timeout
    });
  }

  /**
   * Close the node.
   */
  onClose() {
    internalDebugLog("[onClose()] closed!");
  }

  /**
   * Hide any notifications on the node.
   *
   * @returns Return current unix time.
   */
  getUnixTime() {
    return (new Date().getTime() / 1000) | 0;
  }

  /**
   * Generate the HMAC signature for a message.
   *
   * @param message complete message.
   * @param appsecert AppSecret from the Portal.
   * @returns Return the signature.
   */
  getSignature(message, appsecert) {
    return crypto
      .createHmac("sha256", appsecert)
      .update(message)
      .digest("base64");
  }

  /**
   * Called when node recevice a message.
   *
   * @param msg message.
   */
  onInput(msg) {
    internalDebugLog("[onInput()] input: ", msg);

    try {
      const action = msg.action;
      if (!action) {
        this.errorStatus({ message: "Please provide an action name in msg.action" });
        return;
      }

      const deviceId = msg.deviceId;
      if (!deviceId) {
        this.errorStatus({ message: "Please provide an deviceId name in msg.deviceId" });
        return;
      }

      const value = msg.value;
      if (!value) {
        this.errorStatus({ message: "Please provide an value in msg.value" });
        return;
      }

      // additional validations for respose.
      if (this.nodeType === "responseNode") {
        if (!msg.replyToken) {
          this.errorStatus({ message: "Please provide an replyToken in msg.replyToken" });
          return;
        }

        if (!msg.success) {
          this.errorStatus({ message: "Please provide an success in msg.success" });
          return;
        }
      }

      // additional validations for events
      if (this.nodeType === "eventNode") { 
        if (!this.limiter.consumeSync(deviceId)) { 
          internalDebugLog("[onClose()] Message rate-limit activated!");
          this.errorStatus({ message: "WARNING: YOUR CODE SENDS EXCESSIVE EVENTS!", timeout:1000 });
          return;
        }
      }

      const success = msg.success || null;
      const replyToken = msg.replyToken || null;
      const message = msg.message || "OK";
      const appsecret = this.self.context().flow.get("appsecret");
      const type = this.nodeType === "responseNode" ? "response" : "event";
      
      let payload = {};

      if (this.nodeType === "responseNode") {
        const clientId = this.self.context().flow.get("request-client-id") ?? 'node-red';

        payload = {
          replyToken: replyToken,
          success: success,
          message: message,
          createdAt: this.getUnixTime(),
          deviceId: deviceId,
          clientId: clientId,
          type: type,
          action: action,
          value: value
        };
      } else if (this.nodeType === "eventNode") {
        payload = {
          message: message,
          cause: { type: "PHYSICAL_INTERACTION" },
          createdAt: this.getUnixTime(),
          deviceId: deviceId,
          clientId: 'node-red',
          type: type,
          action: action,
          value: value
        };
      }

      const HMAC = this.getSignature(JSON.stringify(payload), appsecret);
      const signature = { HMAC: HMAC };
      const header = { payloadVersion: 2, signatureVersion: 1 };
      const reply = {
        header: header,
        payload: payload,
        signature: signature
      };

      const websocket = this.self.context().flow.get("websocket");
      websocket.send(JSON.stringify(reply));

      this.infoStatus({ message: "Sent !", timeout: 1500 });
      internalDebugLog("[onInput()]: => " + JSON.stringify(reply));
    } catch (e) {
      internalDebugLog(e);
      this.errorStatus(e);
      return;
    }
  }

  verifySignature(data) {
    const { payload, signature } = JSON.parse(data);
    const appSecert = this.self.context().flow.get("appsecret");
    const calculatedSig = this.getSignature(JSON.stringify(payload), appSecert);

    if (signature.HMAC === calculatedSig) { 
      let createdAtTs = Number(payload.createdAt) * 1000;
      let isPayloadCreatedAtTooOld = moment().subtract(2, 'minutes').isAfter(new Date(createdAtTs));
      
      if (isPayloadCreatedAtTooOld) { 
        internalDebugLog(`[verifySignature()]: timestamp is too old!`);
        return false;
      } else {
        return true;
      }
    } else {
      internalDebugLog(`[verifySignature()]: signature mismatch. expected: ${calculatedSig} signature: ${signature}`);
      return false;
    }
  }

  /**
   * Connect to Sinric Pro Websocket server and listen to commands. Only one connection per flow
   */
  connectOnce(self, node) {
    if (!this.appcredential || !this.appcredential.appkey) {
      return;
    }

    flowDeviceMap.set(this.self.deviceId, this.self);
    
    const connectionState = self.context().flow.get("webScoketConnectionState") || 0;
    if (connectionState != 0) {
      return;
    }

    self.context().flow.set("webScoketConnectionState", 1);

    internalDebugLog("[connectOnce()]: Connecting with AppKey: ", this.appcredential.appkey);

    const wsOptions = {
      headers: {
        appkey: this.appcredential.appkey,
        restoredevicestates: false,
        platform: 'node-red',
        sdkversion: pjson.version
      }
    };

    const client = new ReconnectingWebSocket(API_ENDPOINT, wsOptions);
    this.self.context().flow.set("websocket", client);

    client.onopen = event => {
      node.connected = true;
      internalDebugLog("[connectOnce()]: Connected..!");
    };

    client.onclose = () => {
      node.connected = false;
      internalDebugLog("[connectOnce()]: Disconnected..!");
    };

    client.onmessage = event => {
      internalDebugLog("[onmessage()]: <= ", event.data);

      // ignore initial timestamp message
      const isTimeStamp = event.data.indexOf("timestamp") == 2;
      if (isTimeStamp) {
        internalDebugLog("[onmessage()]: Got timestamp..!");
        return;
      }

      const { payload } = JSON.parse(event.data);
      
      if(flowDeviceMap.has(payload.deviceId)) {
        const targetNode = flowDeviceMap.get(payload.deviceId);
        this.self.context().flow.set("request-client-id", payload.clientId);

        if(this.verifySignature(event.data)) {
          internalDebugLog("[onmessage()]: Forwarding to node with device id: %s", targetNode.deviceId);
          targetNode.send({ payload });
          this.infoStatus({ message: `${payload.action}`, timeout: 1500, node: targetNode });     
        } else {
          this.errorStatus({ message: `Message verification failed!`, timeout: 1500, node: targetNode });
        }
      } else {
        this.errorStatus({ message: `Device id: ${payload.deviceId} not found!`, timeout: 1500 });
        internalDebugLog("[onmessage()]: deviceId: %s not in flowDeviceMap..!", payload.deviceId);
      }
    };
  }
}

module.exports = SinricProBaseNode;
