import noble from "@abandonware/noble";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import fs from "fs";
import { ActivitySession, CadenceEvent, HeartRateEvent, PowerEvent } from "./ActivitySession";

const app = express();
const port = 3001;
app.use(cors());

let session: ActivitySession | null = null;

function writeActivitySession(session: ActivitySession) {
  const dir = "./data";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  const ts = new Date(session.startTimestamp).toISOString().slice(0, 19).replace(/[-:]/g, "");
  const fn = `${dir}/activity_${ts}.json`;
  fs.writeFileSync(fn, JSON.stringify(session, null, 2), "utf-8");
}

app.get("/", (req, res) => {
  res.json({});
});

app.get("/session", (req, res) => {
  res.json(session);
});

app.get("/start", (req, res) => {
  if (!session) {
    session = new ActivitySession(Date.now());
  }
  res.json({ startTimestamp: session.startTimestamp });
});

app.get("/stop", (req, res) => {
  if (session) {
    session.stopTimestamp = Date.now();
  }
  res.json(session ? { stopTimestamp: session.stopTimestamp } : {});
});

app.get("/reset", (req, res) => {
  if (session) {
    writeActivitySession(session);
  }
  session = null;
  res.json({});
});

const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// setInterval(() => {
//   if (session) {
//     const event: PowerEvent = { timestamp: Date.now(), value: 220 + Math.floor(100 * Math.random()) };
//     session.pushPowerEvent(event);
//     io.emit("Power", event);
//   }
// }, 1105);

// Run this on Linux (to avoid running as sudo):
// sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)

// "FF:D8:97:AF:08:34"
// "a026e005-0a7d-4ab3-97fa-f1500f9feb8b"
// 651e7ad1ffa1433488fc191399c9f655

interface Device {
  peripheral: noble.Peripheral;
  manufacturerName: string | null;
  batteryLevel: number | null;
  firmwareRevision: string | null;
  hardwareRevision: string | null;
  serialNumber: string | null;
  lastEventTimestamp: number | null;
}

type DevicesDict = { [id: string]: Device };
const devices: DevicesDict = {};

async function readValue(
  services: noble.Service[],
  serviceUuid: string,
  characteristicUuid: string,
  toValue: (buffer: Buffer) => any
) {
  // const service = services.find((d) => d.uuid === serviceUuid);
  // if (!service) return null;
  // const cs: noble.Characteristic[] | null = await service.discoverCharacteristicsAsync();
  let c: noble.Characteristic | null = null;
  services.find((d) => d.uuid === serviceUuid && d.characteristics.find((e) => e.uuid === characteristicUuid));
  for (let i = 0; i < services.length; i++) {
    const s = services[i];
    c = s.characteristics.find((e) => e.uuid === characteristicUuid) ?? null;
    if (c) break;
  }
  if (!c) return null;
  try {
    const buf = await c.readAsync();
    return toValue(buf);
  } catch (e) {
    console.log(e);
  }
  return null;
}

setInterval(async () => {
  for (let [id, device] of Object.entries(devices)) {
    const { peripheral } = device;
    if (peripheral.state === "connected") continue;
    const { localName } = peripheral.advertisement;
    console.log("device disconnected", localName);
    await connectPeripheral(peripheral, localName);
  }
}, 10000);

function setLastEventTime(peripheral: noble.Peripheral) {
  const dev = devices[peripheral.id];
  if (dev) {
    dev.lastEventTimestamp = Date.now();
  }
}

async function connectPeripheral(peripheral: noble.Peripheral, localName: string) {
  await peripheral.connectAsync();
  if (!devices[peripheral.id]) {
    devices[peripheral.id] = {
      peripheral,
      manufacturerName: null,
      batteryLevel: null,
      firmwareRevision: null,
      hardwareRevision: null,
      serialNumber: null,
      lastEventTimestamp: null
    };
  }

  const { services } = await peripheral.discoverAllServicesAndCharacteristicsAsync();
  const s = services.find((d) => d.uuid === "180a");
  if (s) {
    const cs = await s.discoverCharacteristicsAsync();
    console.log(cs.map((d) => d.uuid).join(","));
  }
  // Battery Level
  readValue(services, "180f", "2a19", (buf) => buf.readUInt8(0)).then((v) => {
    console.log("Battery level", localName, v);
    devices[peripheral.id].batteryLevel = v;
  });
  // Manufacturer Name String
  readValue(services, "180a", "2a29", (buf) => buf.toString("utf8")).then((v) => {
    console.log("manufacturerName", v);
    devices[peripheral.id].manufacturerName = v;
  });
  // Hardware Revision String
  readValue(services, "180a", "2a27", (buf) => buf.toString("utf8")).then((v) => {
    devices[peripheral.id].hardwareRevision = v;
  });
  // Firmware Revision String
  readValue(services, "180a", "2a26", (buf) => buf.toString("utf8")).then((v) => {
    devices[peripheral.id].firmwareRevision = v;
  });
  // Serial Number String
  readValue(services, "180a", "2a25", (buf) => buf.toString("utf8")).then((v) => {
    devices[peripheral.id].serialNumber = v;
  });

  const heartRateService = services.find((d) => d.uuid === "180d");
  const cadenceService = services.find((d) => d.uuid === "1816");
  const powerService = services.find((d) => d.uuid === "1818");

  if (cadenceService) {
    // 2a5b CSC Measurement
    const c = cadenceService.characteristics.find((d) => d.uuid === "2a5b");
    // const characteristics = await cadenceService.discoverCharacteristicsAsync(["2a5b"]);
    // if (!characteristics || characteristics.length !== 1) return;
    // const c = characteristics[0];
    if (c) {
      // value = await c.readAsync();
      await c.subscribeAsync();
      c.on("data", (v: Buffer) => {
        const s = [0, 1, 2, 3, 4].map((d) => v.readUInt8(d));
        const c = v.readUInt16LE(1);
        const t = v.readUInt16LE(3) / 1024;
        console.log(`${s.join(",")} - ${c} - ${t.toFixed(2)} - ${(Date.now() % 600000) / 1000}`);
        const event = { revolutions: c, eventTime: t, timestamp: Date.now() };
        io.emit("Cadence", event);
        if (session) {
          session.pushCadenceEvent(event);
        }
        setLastEventTime(peripheral);
      });
    }
  }
  if (powerService && localName.startsWith("KICKR SNAP")) {
    //(localName.startsWith("KICKR SNAP")) {
    // console.log("discoverServicesAsync", s);
    // 2a5b CSC Measurement
    // 1818 2a63
    const c = powerService.characteristics.find((d) => d.uuid === "2a63");
    // const characteristics = await powerService.discoverCharacteristicsAsync(["2a63"]);
    // if (!characteristics || characteristics.length !== 1) return;
    // const c = characteristics[0];
    if (c) {
      // value = await c.readAsync();
      await c.subscribeAsync();
      c.on("data", (buf: Buffer) => {
        const s = [...Array(buf.length)].map((d, i) => buf.readUInt8(i).toFixed(0).padStart(3, " "));
        const p = buf.readInt16LE(2);
        console.log(`${p.toFixed(0).padStart(3, " ")} - ${s.join(",")}`);
        const event = { value: p, timestamp: Date.now() };
        io.emit("Power", event);
        if (session) {
          session.pushPowerEvent(event);
        }
        setLastEventTime(peripheral);
      });
    }
  }
  // Heart rate
  if (heartRateService) {
    // const characteristics = await heartRateService.discoverCharacteristicsAsync(["2a37"]);
    const c = heartRateService.characteristics.find((d) => d.uuid === "2a37");
    // if (!characteristics || characteristics.length !== 1) return;
    // const c = characteristics[0];
    if (c) {
      // value = await c.readAsync();
      await c.subscribeAsync();
      c.on("data", (buf: Buffer) => {
        if (buf.length < 1) return;
        // const s = [...Array(buf.length)].map((d, i) => buf.readUInt8(i).toFixed(0).padStart(3, " "));
        console.log(`Heart rate ${buf.readUInt8(1)}`);
        const v = buf.readUInt8(1);
        const event: HeartRateEvent = { value: v, timestamp: Date.now() };
        io.emit("HeartRate", event);
        if (session) {
          session.pushHeartRateEvent(event);
        }
        setLastEventTime(peripheral);
      });
    }
  }
}

async function main() {
  try {
    await noble.startScanningAsync();
    noble.on("discover", async (peripheral) => {
      // await noble.stopScanningAsync();
      try {
        const { advertisement, uuid, addressType, address } = peripheral;
        if (!advertisement || addressType === "unknown") return;
        const { localName, serviceUuids } = advertisement;
        if (!localName || !serviceUuids) return;
        console.log(uuid, localName, address, serviceUuids);
        if (!peripheral.connectable) return;
        const wantedUuid = ["180d", "1816", "1818"];
        if (!(serviceUuids as string[]).some((d) => wantedUuid.find((e) => e === d))) return;

        await connectPeripheral(peripheral, localName);
      } catch (e) {
        console.log(e);
      }
    });
  } catch (e) {
    console.log(e);
  }
}

main();
