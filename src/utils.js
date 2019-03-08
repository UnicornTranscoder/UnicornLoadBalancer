import redisClient from "redis";

import config from "./config";

export const publicUrl = () => {
  return config.server.public;
};

export const internalUrl = () => {
  return "http://127.0.0.1:" + config.server.port + "/";
};

export const plexUrl = () => {
  return "http://" + config.plex.host + ":" + config.plex.port + "/";
};

export const getRedisClient = () => {
  if (config.redis.password === "") delete config.redis.password;

  let redis = redisClient.createClient(config.redis);
  redis.on("error", (err) => {
    if (err.errno === "ECONNREFUSED")
      return console.error(
        "Failed to connect to REDIS, please check your configuration",
      );
    return console.error(err.errno);
  });

  redis.on("connect", () => {
    redis.send_command("config", ["set", "notify-keyspace-events", "KEA"]);
  });
  return redis;
};

export const time = () => Math.floor(new Date().getTime() / 1000);
