const { floor } = Math;

export interface Record {
  elapsedTime: number;
  lapIndex: number;
  power: number | null;
  heartRate: number | null;
  cadence: number | null;
  leftRightBalance: number | null;
}

export interface CadenceEvent {
  timestamp: number;
  revolutions: number;
  eventTime: number;
}

export interface HeartRateEvent {
  timestamp: number;
  value: number;
}

export interface PowerEvent {
  timestamp: number;
  value: number;
}

export function calcCadence(index: number, cadenceEvents: CadenceEvent[]): number | null {
  if (index <= 0) return null;
  const endEvent = cadenceEvents[index];
  for (let i = index - 1; i >= 0; i--) {
    const e = cadenceEvents[i];
    if (endEvent.timestamp - e.timestamp > 3500 || endEvent.eventTime !== e.eventTime) {
      let dt = endEvent.eventTime - e.eventTime;
      if (dt < 0) {
        dt += 64;
      }
      if (dt === 0) return 0;
      let v = (60 * (endEvent.revolutions - e.revolutions)) / dt;
      if (v > 180) return 180;
      return v;
    }
  }
  return null;
}

export class ActivitySession {
  constructor(startTimestamp: number) {
    this.records = [];
    this.heartRateEvents = [];
    this.cadenceEvents = [];
    this.powerEvents = [];
    this.startTimestamp = startTimestamp;
    this.currentLapIndex = 0;
    this.recordsTimestep = 1000;
  }
  records: Record[];
  heartRateEvents: HeartRateEvent[];
  cadenceEvents: CadenceEvent[];
  powerEvents: PowerEvent[];
  startTimestamp: number;
  currentLapIndex: number;
  recordsTimestep: number;

  createRecords(maxIndex: number): void {
    if (maxIndex > this.records.length - 1) {
      for (let i = this.records.length; i <= maxIndex; i++) {
        this.records.push({
          elapsedTime: (i + 1) * this.recordsTimestep,
          lapIndex: this.currentLapIndex,
          power: null,
          heartRate: null,
          cadence: null,
          leftRightBalance: null,
        });
      }
    }
  }

  isValidTimestamp(timestamp: number, events: HeartRateEvent[] | PowerEvent[] | CadenceEvent[]): boolean {
    if (events.length > 0 && timestamp <= events[events.length - 1].timestamp) return false;
    if (timestamp < this.startTimestamp) return false;
    return true;
  }

  pushHeartRateEvent(event: HeartRateEvent) {
    if (!this.isValidTimestamp(event.timestamp, this.heartRateEvents)) return;
    this.heartRateEvents.push(event);
    const elapsedTime = event.timestamp - this.startTimestamp;
    const index = floor(elapsedTime / this.recordsTimestep);
    this.createRecords(index);
    if (index - 1 >= 0 && this.records[index - 1].heartRate === null) {
      this.records[index - 1].heartRate = event.value;
    }
    this.records[index].heartRate = event.value;
  }

  pushPowerEvent(event: PowerEvent) {
    if (!this.isValidTimestamp(event.timestamp, this.powerEvents)) return;
    this.powerEvents.push(event);
    const elapsedTime = event.timestamp - this.startTimestamp;
    const index = floor(elapsedTime / this.recordsTimestep);
    this.createRecords(index);
    if (index - 1 >= 0 && this.records[index - 1].power === null) {
      this.records[index - 1].power = event.value;
    }
    this.records[index].power = event.value;
  }

  pushCadenceEvent(event: CadenceEvent) {
    if (!this.isValidTimestamp(event.timestamp, this.cadenceEvents)) return;
    this.cadenceEvents.push(event);
    const elapsedTime = event.timestamp - this.startTimestamp;
    const index = floor(elapsedTime / this.recordsTimestep);
    this.createRecords(index);
    const value = calcCadence(this.cadenceEvents.length - 1, this.cadenceEvents);
    if (index - 1 >= 0 && this.records[index - 1].cadence === null) {
      this.records[index - 1].cadence = value;
    }
    this.records[index].cadence = value;
  }
}

export function indexOf(t: number, vs: any[], compare: (t: number, v: any) => number): number {
  let i = -1;
  let n = vs.length;
  if (n === 0) return -1;
  else if (compare(t, vs[0]) < 0) return -1;
  else if (compare(t, vs[n - 1]) >= 0) return n - 1;

  if (n > 40) {
    //Binary search if >40 (otherwise it's no gain using it)
    let hi = n - 1;
    let low = 0;
    if (compare(t, vs[hi]) >= 0) return hi;
    while (hi > low + 1) {
      i = floor((hi + low) / 2);
      if (compare(t, vs[i]) >= 0) {
        low = i;
      } else {
        hi = i;
        i = low;
      }
    }
    return i;
  } else {
    //Incremental search
    i = 1;
    while (compare(t, vs[i]) >= 0 && i < n - 1) {
      i++;
    }
    return i - 1;
  }
}
