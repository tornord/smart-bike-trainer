const Bluetooth = require("node-web-bluetooth");

const requestBluetoothConnection = async (serviceName, characteristicName, isConnected, setValue) => {
  const device = await Bluetooth.requestDevice({
    filters: [{ services: [serviceName] }],
  });

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(serviceName);

  if (!characteristicName) return;

  const characteristic = await service.getCharacteristic(characteristicName);

  device.addEventListener("gattserverdisconnected", (e) => {
    isConnected(false);
  });

  await characteristic.startNotifications();
  isConnected(true);

  characteristic.addEventListener("characteristicvaluechanged", (event) => {
    const v = event.target.value;
    let value;
    if (characteristicName === "heart_rate_measurement") {
      value = v.getUint8(1);
    }
    if (characteristicName === "cycling_power_measurement") {
      console.log(`${v.getUint16(0, true)}`);
      value = v.getInt16(1);
    }
    if (characteristicName === "csc_measurement") {
      const s = [0, 1, 2, 3, 4].map((d) => v.getUint8(d));
      const c = v.getUint16(1, true);
      const t = v.getUint16(3, true) / 1024;
      console.log(
        `${s.join(",")} - ${c} - ${t.toFixed(2)} - ${(Date.now() % 600000) / 1000} - ${
          device.gatt.connected ? "true" : "false"
        }`
      );
      value = `${c} - ${t.toFixed(2)}`;
    }
    if (value !== 0) {
      setValue(value);
    }
  });
};

requestBluetoothConnection(
  "cycling_power",
  "cycling_power_measurement",
  (e) => console.log(`Connected: ${e ? "yes" : "no"}`),
  (e) => console.log(`Power: ${e}`)
);
