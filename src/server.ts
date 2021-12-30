import crypto from "crypto";
import fs from "fs";

import cors from "cors";
import express from "express";
import noble from "@abandonware/noble";
import { Server } from "socket.io";

import { ActivitySession, HeartRateEvent } from "./ActivitySession";
import * as config from "./config";

const { SERVER_URL, SERVER_PORT, CADENCE_UUID, HEART_RATE_UUID, POWER_UUID } = config;
const DEBUG = false;
const app = express();
app.use(cors());

let session: ActivitySession | null = null;
let writePowerCharacteristics: noble.Characteristic | null = null;
const DEFAULT_CONTROL_POWER = 50;
let controlPower = DEFAULT_CONTROL_POWER;

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

const server = app.listen(SERVER_PORT, () => {
  console.log(`Listening at ${SERVER_URL}:${SERVER_PORT}`);
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", function (socket) {
  console.log("connection");

  socket.on("disconnect", function () {
    console.log("disconnect");
  });
});

app.get("/writepower", async (req, res) => {
  let { watt: wattAsString } = req.query;
  const watt = Number(wattAsString);
  console.log(`writePower ${writePowerCharacteristics ? "power connected" : "no power"}`, watt);
  if (writePowerCharacteristics) {
    await writeErgLoad(writePowerCharacteristics, watt);
    controlPower = watt;
    io.emit("ControlPower", { value: watt });
  }
  res.json({ connected: writePowerCharacteristics !== null, controlPower });
});

app.get("/devices", (req, res) => {
  const ds = getDevices();
  res.json(ds);
});

app.get("/activities/:activityId", (req, res) => {
  const { activityId } = req.params;
  const fn = `./data/activity_${activityId}.json`;
  if (!fs.existsSync(fn)) return res.json(null);
  const data = JSON.parse(fs.readFileSync(fn, "utf8"));
  res.json(data);
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

interface Service {
  service: noble.Service | null;
  peripheral: noble.Peripheral | null;
}

interface Services {
  heartRate: Service;
  cadence: Service;
  power: Service;
}

function createService(): Service {
  return { service: null, peripheral: null };
}

type DevicesDict = { [id: string]: Device };
const devices: DevicesDict = {};
const lastDevicesHash = "";
const services: Services = { heartRate: createService(), cadence: createService(), power: createService() };

function getDevices() {
  return Object.values(devices).map((d) => {
    const { advertisement, uuid } = d.peripheral;
    const { localName, serviceUuids } = advertisement;
    return {
      localName,
      uuid,
      manufacturerName: d.manufacturerName,
      batteryLevel: d.batteryLevel,
      firmwareRevision: d.firmwareRevision,
      hardwareRevision: d.hardwareRevision,
      serialNumber: d.serialNumber,
      lastEventTimestamp: d.lastEventTimestamp,
      state: d.peripheral.state,
      serviceUuids,
    };
  });
}

function sendDevices() {
  const json = getDevices();
  const sha256 = crypto.createHash("sha256").update(JSON.stringify(json, null, 2)).digest("hex");
  if (lastDevicesHash === sha256) return;
  console.log("sha256", sha256);
}

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
    const { localName } = peripheral.advertisement;
    if (peripheral.state !== "connected") {
      console.log(localName, peripheral.state);
    }
    if (peripheral.state !== "disconnected") continue;
    try {
      await connectPeripheral(peripheral, localName, false);
    } catch (e) {
      console.log(e);
    }
  }
}, 10000);

function setLastEventTime(peripheral: noble.Peripheral) {
  const dev = devices[peripheral.id];
  if (dev) {
    dev.lastEventTimestamp = Date.now();
  }
}

async function connectHeartRateService() {
  // const characteristics = await heartRateService.discoverCharacteristicsAsync(["2a37"]);
  const c = services.heartRate.service?.characteristics.find((d) => d.uuid === "2a37");
  // if (!characteristics || characteristics.length !== 1) return;
  // const c = characteristics[0];
  if (c) {
    // value = await c.readAsync();
    await c.subscribeAsync();
    c.on("data", (buf: Buffer) => {
      if (buf.length < 1) return;
      // const s = [...Array(buf.length)].map((d, i) => buf.readUInt8(i).toFixed(0).padStart(3, " "));
      if (DEBUG) {
        console.log(`Heart rate ${buf.readUInt8(1)}`);
      }
      const v = buf.readUInt8(1);
      const event: HeartRateEvent = { value: v, timestamp: Date.now() };
      io.emit("HeartRate", event);
      if (session) {
        session.pushHeartRateEvent(event);
      }
      setLastEventTime(services.heartRate?.peripheral as noble.Peripheral);
    });
  }
}

async function connectCadenceService() {
  // 2a5b CSC Measurement
  const c = services.cadence.service?.characteristics.find((d) => d.uuid === "2a5b");
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
      if (DEBUG) {
        console.log(`${s.join(",")} - ${c} - ${t.toFixed(2)} - ${(Date.now() % 600000) / 1000}`);
      }
      const event = { revolutions: c, eventTime: t, timestamp: Date.now() };
      io.emit("Cadence", event);
      if (session) {
        session.pushCadenceEvent(event);
      }
      setLastEventTime(services.cadence?.peripheral as noble.Peripheral);
    });
  }
}

async function connectPowerService() {
  //(localName.startsWith("KICKR SNAP")) {
  // console.log("discoverServicesAsync", s);
  // 2a5b CSC Measurement
  // 1818 2a63
  const powerService = services.power.service as noble.Service;
  const c = powerService.characteristics.find((d) => d.uuid === "2a63");
  writePowerCharacteristics =
    powerService.characteristics.find((d) => d.uuid === "a026e0050a7d4ab397faf1500f9feb8b") ?? null;
  if (writePowerCharacteristics) {
    await writePowerCharacteristics.subscribeAsync();
    if (controlPower !== DEFAULT_CONTROL_POWER) {
      await writeErgLoad(writePowerCharacteristics, controlPower);
    }
  }

  // const characteristics = await powerService.discoverCharacteristicsAsync(["2a63"]);
  // if (!characteristics || characteristics.length !== 1) return;
  // const c = characteristics[0];
  if (c) {
    // value = await c.readAsync();
    await c.subscribeAsync();
    c.on("data", (buf: Buffer) => {
      const s = [...Array(buf.length)].map((d, i) => buf.readUInt8(i).toFixed(0).padStart(3, " "));
      const p = buf.readInt16LE(2);
      if (DEBUG) {
        console.log(`${p.toFixed(0).padStart(3, " ")} - ${s.join(",")}`);
      }
      const event = { value: p, timestamp: Date.now() };
      io.emit("Power", event);
      if (session) {
        session.pushPowerEvent(event);
      }
      setLastEventTime(services.power?.peripheral as noble.Peripheral);
    });
  }
}

async function connectPeripheral(peripheral: noble.Peripheral, localName: string, readDeviceInfo: boolean) {
  console.log(localName, "trying to connect");
  await peripheral.connectAsync();

  const { services: allServices } = await peripheral.discoverAllServicesAndCharacteristicsAsync();

  const heartRateService = allServices.find((d) => d.uuid === "180d");
  const cadenceService = allServices.find((d) => d.uuid === "1816");
  const powerService = allServices.find((d) => d.uuid === "1818");

  let newService = false;
  let reconnectedService = false;

  if (services.heartRate.service && services.heartRate.peripheral?.uuid === peripheral.uuid) {
    reconnectedService = true;
    await connectHeartRateService();
  }

  if (services.cadence.service && services.cadence.peripheral?.uuid === peripheral.uuid) {
    reconnectedService = true;
    await connectCadenceService();
  }

  if (services.power.service && services.power.peripheral?.uuid === peripheral.uuid) {
    reconnectedService = true;
    await connectPowerService();
  }

  if (reconnectedService) {
    console.log(localName, "reconnected");
    return;
  }

  if (!services.heartRate.service && heartRateService && !(HEART_RATE_UUID && peripheral.uuid !== HEART_RATE_UUID)) {
    newService = true;
    services.heartRate.service = heartRateService;
    services.heartRate.peripheral = peripheral;
    await connectHeartRateService();
  }
  if (!services.cadence.service && cadenceService && !(CADENCE_UUID && peripheral.uuid !== CADENCE_UUID)) {
    newService = true;
    services.cadence.service = cadenceService;
    services.cadence.peripheral = peripheral;
    await connectCadenceService();
  }
  if (!services.power.service && powerService && !(POWER_UUID && peripheral.uuid !== POWER_UUID)) {
    newService = true;
    services.power.service = powerService;
    services.power.peripheral = peripheral;
    await connectPowerService();
  }

  if (!newService) {
    console.log(localName, "ignored");
    return;
  }

  if (!devices[peripheral.id]) {
    devices[peripheral.id] = {
      peripheral,
      manufacturerName: null,
      batteryLevel: null,
      firmwareRevision: null,
      hardwareRevision: null,
      serialNumber: null,
      lastEventTimestamp: null,
    };
  }

  if (readDeviceInfo) {
    readValue(allServices, "180f", "2a19", (buf) => buf.readUInt8(0)).then((v) => {
      console.log("Battery level", localName, v);
      devices[peripheral.id].batteryLevel = v;
    });
    // Manufacturer Name String
    readValue(allServices, "180a", "2a29", (buf) => buf.toString("utf8")).then((v) => {
      console.log("Manufacturer Name", v);
      devices[peripheral.id].manufacturerName = v;
    });
    // Hardware Revision String
    readValue(allServices, "180a", "2a27", (buf) => buf.toString("utf8")).then((v) => {
      devices[peripheral.id].hardwareRevision = v;
    });
    // Firmware Revision String
    readValue(allServices, "180a", "2a26", (buf) => buf.toString("utf8")).then((v) => {
      devices[peripheral.id].firmwareRevision = v;
    });
    // Serial Number String
    readValue(allServices, "180a", "2a25", (buf) => buf.toString("utf8")).then((v) => {
      devices[peripheral.id].serialNumber = v;
    });
  }

  console.log(localName, "connected");
}

async function writeErgLoad(c: noble.Characteristic, watt: number) {
  const dv = new DataView(new ArrayBuffer(3));
  dv.setInt8(0, 66);
  dv.setUint16(1, watt, true);
  try {
    await c.writeAsync(Buffer.from(dv.buffer), false);
  } catch (e) {
    console.log(e);
  }
}

async function main() {
  try {
    await noble.startScanningAsync();
    noble.on("discover", async (peripheral) => {
      // await noble.stopScanningAsync();
      try {
        const { advertisement, uuid, address } = peripheral;
        if (!advertisement) return;
        const { localName, serviceUuids } = advertisement;
        if (!localName || !serviceUuids) return;
        console.log(uuid, localName, address, serviceUuids);
        if (!peripheral.connectable) return;
        const wantedUuid = ["180d", "1816", "1818"]; // hr, cad, pwr
        if (!(serviceUuids as string[]).some((d) => wantedUuid.find((e) => e === d))) return;

        await connectPeripheral(peripheral, localName, true);
      } catch (e) {
        console.log(e);
      }
    });
  } catch (e) {
    console.log(e);
  }
}

main();
