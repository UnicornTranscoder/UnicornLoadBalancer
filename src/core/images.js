import fetch from "node-fetch";
import sharp from "sharp";
import color from "color";
import md5 from "md5";
import {parseUserAgent} from "detect-browser";

export const parseArguments = (query, basepath = "/", useragent = "") => {
  // Parse url
  let url = query.url || "";
  url = url.replace("http://127.0.0.1/", "/");
  url = url.replace("http://127.0.0.1:32400/", "/");
  url = url.replace(basepath, "/");
  if (query["X-Plex-Token"] && url && url[0] === "/") {
    url +=
      url.indexOf("?") === -1
        ? `?X-Plex-Token=${query["X-Plex-Token"]}`
        : `&X-Plex-Token=${query["X-Plex-Token"]}`;
  }
  if (url && url[0] === "/") url = basepath + url.substring(1);

  // Extract parameters
  const params = {
    ...(query.width ? {width: parseInt(query.width)} : {}),
    ...(query.height ? {height: parseInt(query.height)} : {}),
    ...(query.background ? {background: query.background} : {}),
    ...(query.opacity ? {opacity: parseInt(query.opacity)} : {}),
    ...(query.minSize ? {minSize: parseInt(query.minSize)} : {}),
    ...(query.blur ? {blur: parseInt(query.blur)} : {}),
    ...(query.format && (query.format === "webp" || query.format === "png")
      ? {format: query.format}
      : {format: "jpg"}),
    ...(query.upscale ? {upscale: parseInt(query.upscale)} : {}),
    ...(query.quality
      ? {quality: parseInt(query.quality)}
      : query.blur
      ? {quality: 100}
      : {quality: 70}),
    alpha: query.format === "png",
    ...(query["X-Plex-Token"] ? {"X-Plex-Token": query["X-Plex-Token"]} : {}),
    url,
  };

  // Auto select WebP if user-agent support it
  const browser = parseUserAgent(useragent);
  if (browser && browser.name && browser.name === "chrome" && !query.format) {
    params.format = "webp";
  }

  // Generate key
  params.key = md5(
    `${(query.url || "").split("?")[0]}|${params.width || ""}|${params.height ||
      ""}|${params.background || ""}|${params.opacity || ""}|${params.minSize ||
      ""}|${params.blur || ""}|${params.format || ""}|${params.upscale ||
      ""}|${params.quality || ""}`.toLowerCase(),
  );

  // Return params
  return params;
};

export const resize = (parameters, headers = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      const params = {
        // Width of the image (px value)
        width: false,

        // Height of the image (px value)
        height: false,

        // Background color
        background: false,

        // Background opacity
        opacity: false,

        // Resize constraint (0:height / 1:width)
        minSize: 0,

        // Blur on picture (between 0 and 10000)
        blur: 0,

        // Output format
        format: false, // png / jpg / webp

        // Force upscale
        upscale: false,

        // User parameters
        ...parameters,
      };

      if (!params.width || !params.height) return reject("Size not provided");

      // Erase previous host header
      delete headers.host;

      // Get image content
      const body = await fetch(parameters.url, {
        headers,
      }).then((res) => res.buffer());

      // Load body
      let s = false;
      try {
        s = sharp(body).on("error", (err) => {
          return reject(err);
        });
      } catch (e) {
        return reject(e);
      }
      if (!s) return reject(e);

      // Resize parameters
      const opt = {
        ...(params.upscale ? {withoutEnlargement: !!params.upscale} : {}),
      };

      // Resize based on width
      try {
        if (params.minSize === 1) s.resize(params.width, null, opt);
        else s.resize(null, params.height, opt);
      } catch (e) {
        return reject(e);
      }

      // Background & opacity support
      if (params.background && params.opacity) {
        let bgd = false;
        try {
          const buff = await s.png().toBuffer();
          s = sharp(buff).on("error", (err) => {
            return reject(err);
          });
          const meta = await s.metadata();
          bgd = await sharp({
            create: {
              width: meta.width,
              height: meta.height,
              channels: 4,
              background: {
                r: color(`#${params.background}`).r,
                g: color(`#${params.background}`).g,
                b: color(`#${params.background}`).b,
                alpha: (100 - params.opacity) / 100,
              },
            },
          })
            .on("error", (err) => {
              return reject(err);
            })
            .png()
            .toBuffer();
        } catch (e) {
          return reject(e);
        }
        s.overlayWith(bgd);
      }

      // Blur
      if (params.blur > 0 && params.blur <= 1000)
        s.blur(params.blur * 1.25).gamma(2);

      // Output format
      if (params.format === "jpg")
        s.jpeg({
          quality: params.quality,
        });
      else if (params.format === "png")
        s.png({
          quality: params.quality,
          progressive: true,
          compressionLevel: 9,
        });
      else if (params.format === "webp")
        s.webp({
          quality: params.quality,
          ...(parameters.alpha ? {} : {alphaQuality: 0}),
        });

      // Return stream
      resolve(s);
    } catch (err) {
      reject(err);
    }
  });
};
