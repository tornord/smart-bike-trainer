const noble = require("@abandonware/noble");
const express = require("express");
const app = express();
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

// "FF:D8:97:AF:08:34"
// "a026e005-0a7d-4ab3-97fa-f1500f9feb8b"
// 651e7ad1ffa1433488fc191399c9f655

async function main() {
  try {
    await noble.startScanningAsync();
    noble.on("discover", async (peripheral) => {
      // await noble.stopScanningAsync();
      if (!peripheral.advertisement.localName || !peripheral.advertisement.localName.startsWith("KICKR SNAP")) return;
      await peripheral.connectAsync();
      const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(["1818"]);
      const c = characteristics.find((d) => d.uuid === "2a65");
      let value = 0;
      if (c) {
        value = await c.readAsync();
      }
      console.log(`${peripheral.address} (${peripheral.advertisement.localName}): ${value}%`);
      await peripheral.disconnectAsync();
    });
  } catch (e) {
    console.log(e);
  }
}

main();

// noble.on("stateChange", async (state) => {
//   if (state === "poweredOn") {
//     await noble.startScanningAsync(["KICKR SNAP B1AA"], false);
//   }
// });

// noble.on("discover", async (peripheral) => {
//   await noble.stopScanningAsync();
//   await peripheral.connectAsync();
//   const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(["180f"], ["2a19"]);
//   const batteryLevel = (await characteristics[0].readAsync())[0];

//   console.log(`${peripheral.address} (${peripheral.advertisement.localName}): ${batteryLevel}%`);

//   await peripheral.disconnectAsync();
//   process.exit(0);
// });
