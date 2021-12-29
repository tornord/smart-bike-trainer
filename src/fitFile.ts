import fs from "fs";

import AdmZip from "adm-zip";
import FitParser from "fit-file-parser";
import { Record } from "./ActivitySession";

export async function readFitFile(activityId: string, dataPath: string = "./data") {
  let fn = `${dataPath}/${activityId}.zip`;
  let buf;
  buf = fs.readFileSync(fn);
  const zip = new AdmZip(buf);
  const zipEntries = zip.getEntries();
  const entry = zipEntries[0];
  const fit = entry.getData();

  const fitParser = new FitParser({
    force: true,
    speedUnit: "km/h",
    lengthUnit: "km",
    temperatureUnit: "celcius",
    elapsedRecordField: true,
    mode: "cascade",
  });

  return new Promise((resolve, reject) => {
    fitParser.parse(fit, (error: any, data: any) => {
      if (error) {
        reject(error);
      }
      resolve(data);
    });
  });
}

export function toRecords(fitActivitySession: any) {
  const records: Record[] = [];
  fitActivitySession.laps.forEach((d: any, i: number) => {
    records.push(
      ...d.records.map((r: any) => ({
        elapsedTime: r.elapsed_time,
        lapIndex: i,
        power: typeof r.power === "number" ? r.power : null,
        heartRate: r.heart_rate,
        cadence: r.cadence,
        leftRightBalance: r.left_right_balance
          ? r.left_right_balance.value * (r.left_right_balance.right ? 1 : -1)
          : -1,
      }))
    );
  });
  return records;
}

// async function temp() {
//   const fitData: any = await readFitFile("7764875397", "./test/data");
//   const session = fitData.activity.sessions[0];
//   const recs = toRecords(session);
//   fs.writeFileSync("./src/data/7764875397_records.json", JSON.stringify(recs, null, 2), "utf8");
// }
// temp();
