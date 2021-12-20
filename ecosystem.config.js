module.exports = {
  apps: [
    {
      name: "smart-trainer-web",
      script: "http-server ./build -p 8081",
    },
    {
      name: "smart-trainer-server",
      script: "npm run start:server",
    },
  ],
};
