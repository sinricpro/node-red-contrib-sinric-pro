module.exports = function (RED) {
  function SettingsNode(n) {
    RED.nodes.createNode(this, n);
    this.appkey = n.appkey;
    this.appsecret = n.appsecret;
  }
  RED.nodes.registerType("settings", SettingsNode);
};
