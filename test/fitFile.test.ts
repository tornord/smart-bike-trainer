import { readFitFile } from "./fitFile";

test("readFitFile", async () => {
  const data: any = await readFitFile("7764875397");
  // console.log(data.activity.sessions);
  expect(data.user_profile.friendly_name).toBe("edge530");
  expect(data.activity.timestamp.getTime()).toBe(new Date("2021-11-04T07:08:23.000Z").getTime());
  expect(data.activity.sessions.length).toBe(1);
  const session = data.activity.sessions[0];
  expect(session.sport).toBe("cycling");
  expect(session.normalized_power).toBe(230);
  expect(session.laps.length).toBe(46);
});
