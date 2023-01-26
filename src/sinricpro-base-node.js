"use strict";

const ReconnectingWebSocket = require("./reconnecting-websocket");
const baseURL = "ws://testws.sinric.pro";

class SinricProBaseNode {
  constructor({ self, node, RED }) {
    this.self = self;
    this.node = node;
    this.RED = RED;    
    this.settings = RED.nodes.getNode(node.settings);
    this.self.deviceId = node.deviceid;
    
    this.run(self, node);
  }
 
  run(self, node) {    
    console.log("[SinricProBaseNode]: Connecting with Appkey: ", this.settings.appkey);

    const wsOptions = {
      headers: {
        appkey: this.settings.appkey,
        restoredevicestates: false,
      },
    };

    let client = new ReconnectingWebSocket(baseURL, wsOptions);
    this.websocket = client;

    client.onopen = (event) => {
        node.connected = true;
        console.log('[SinricProBaseNode] Connected..!');        
    };

    client.onmessage = (event) => { 
        console.log('[SinricProBaseNode] < ', event.data);   

        const isTimeStamp = event.data.indexOf("timestamp") == 2;
        if(isTimeStamp) return;

        const { payload } = JSON.parse(event.data);

        if(payload.deviceId == this.self.deviceId) {
          self.send({ payload: JSON.parse(event.data) });
        }
    };

    this.on('close', () => {
        console.log('[SinricProBaseNode] Closed');    
        client.close();
        node.connected = false;
    });
  }
};

module.exports = SinricProBaseNode;