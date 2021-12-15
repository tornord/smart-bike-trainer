import noble from "@abandonware/noble";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { ActivitySession, CadenceEvent, HeartRateEvent, PowerEvent } from "./ActivitySession";

const app = express();
const port = 3001;
app.use(cors());

let session: ActivitySession | null = null;

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

app.get("/reset", (req, res) => {
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

setInterval(() => {
  if (session) {
    const event: HeartRateEvent = { timestamp: Date.now(), value: 120 + Math.floor(20 * Math.random()) };
    session.pushHeartRateEvent(event);
    io.emit("HeartRate", event);
  }
}, 907);
// setInterval(() => {
//   if (session) {
//     const event: CadenceEvent = { timestamp: Date.now(), value: 75 + Math.floor(40 * Math.random()) };
//     io.emit("Cadence", event);
//   }
// }, 1003);
setInterval(() => {
  if (session) {
    const event: PowerEvent = { timestamp: Date.now(), value: 220 + Math.floor(100 * Math.random()) };
    session.pushPowerEvent(event);
    io.emit("Power", event);
  }
}, 1105);

// io.on("connection", (socket: Socket) => {
//   console.log("New client connected");
//   if (interval) {
//     clearInterval(interval);
//   }
//   interval = setInterval(() => getApiAndEmit(socket), 1000);
//   socket.on("disconnect", () => {
//     console.log("Client disconnected");
//     clearInterval(interval);
//   });
// });

// Run this on Linux (to avoid running as sudo):
// sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)

// "FF:D8:97:AF:08:34"
// "a026e005-0a7d-4ab3-97fa-f1500f9feb8b"
// 651e7ad1ffa1433488fc191399c9f655

async function main() {
  try {
    await noble.startScanningAsync();
    noble.on("discover", async (peripheral) => {
      // await noble.stopScanningAsync();
      try {
        if (!peripheral.advertisement.localName) return;
        const { localName } = peripheral.advertisement;
        console.log(peripheral.uuid, peripheral.advertisement.localName);
        if (!localName.startsWith("Wahoo CADENCE")) return; // "KICKR SNAP" "Wahoo CADENCE"
        await peripheral.connectAsync();
        const s = await peripheral.discoverServicesAsync();
        // console.log("discoverServicesAsync", s);
        // 2a5b CSC Measurement
        const { characteristics } = await peripheral.discoverSomeServicesAndCharacteristicsAsync(["1816"], ["2a5b"]);
        const c = characteristics[0]; //characteristics.find((d) => d.uuid === "2a5b"); // 2a63
        let value = 0;
        if (c) {
          // value = await c.readAsync();
          await c.subscribeAsync();
          c.on("data", (v: Buffer) => {
            const s = [0, 1, 2, 3, 4].map((d) => v.readUInt8(d));
            const c = v.readUInt16LE(1);
            const t = v.readUInt16LE(3) / 1024;
            console.log(`${s.join(",")} - ${c} - ${t.toFixed(2)} - ${(Date.now() % 600000) / 1000}`);
            if (session) {
              const event = { revolutions: c, eventTime: t, timestamp: Date.now() };
              io.emit("Cadence", event);
              session.pushCadenceEvent(event);
            }
          });
        }
        console.log(`${peripheral.address} (${peripheral.advertisement.localName}): ${value}%`);
        // await peripheral.disconnectAsync();
      } catch (e) {
        console.log(e);
      }
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
