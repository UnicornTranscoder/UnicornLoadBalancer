import debug from 'debug';
import fetch from 'node-fetch';

import config from '../config';
import Database from '../database';
import SessionsManager from '../core/sessions';
import AWS from '../core/aws';

import RoutesProxy from './proxy';

// Debugger
const D = debug('UnicornLoadBalancer');

let RoutesTranscode = {};

/* Extract IP */
const getIp = (req) => {
  if (req.get('CF-Connecting-IP')) return req.get('CF-Connecting-IP');
  if (req.get('x-forwarded-for')) return req.get('x-forwarded-for').split(',')[0];
  return req.connection.remoteAddress;
};

/* Route to send a 302 to another server */
RoutesTranscode.redirect = async (req, res) => {
  const session = SessionsManager.getSessionFromRequest(req);
  const server = await SessionsManager.chooseServer(session, getIp(req));
  if (server) {
    res.redirect(302, server + req.url);
    D('REDIRECT ' + session + ' [' + server + ']');
  } else {
    res.status(500).send({
      error: { code: 'SERVER_UNAVAILABLE', message: 'SERVER_UNAVAILABLE' },
    });
    D('REDIRECT ' + session + ' [UNKNOWN]');
  }
};

/* Route called when a DASH stream starts */
RoutesTranscode.dashStart = (req, res) => {
  // By default we don't have the session identifier
  let sessionId = false;

  // If we have a cached X-Plex-Session-Identifier, we use it
  if (
    req.query['X-Plex-Session-Identifier'] &&
    SessionsManager.getCacheSession(req.query['X-Plex-Session-Identifier'])
  )
    sessionId = SessionsManager.getCacheSession(req.query['X-Plex-Session-Identifier']);

  // Log
  D('START ' + SessionsManager.getSessionFromRequest(req) + ' [DASH]');

  // Save session
  SessionsManager.cacheSessionFromRequest(req);

  // If session id available
  if (sessionId) SessionsManager.cleanSession(sessionId);

  // Redirect
  RoutesTranscode.redirect(req, res);
};

/* Routes called when a long polling stream starts */
RoutesTranscode.lpStart = (req, res) => {
  // Save session
  SessionsManager.cacheSessionFromRequest(req);

  // Get sessionId
  const sessionId = SessionsManager.getSessionFromRequest(req);

  // Log
  D('START ' + sessionId + ' [LP]');

  // If sessionId is defined
  if (sessionId) SessionsManager.cleanSession(sessionId);

  // Redirect
  RoutesTranscode.redirect(req, res);
};

/* Route called when a HLS stream starts */
RoutesTranscode.hlsStart = (req, res) => {
  // Proxy to Plex
  RoutesProxy.plex(req, res);

  // Save session
  SessionsManager.cacheSessionFromRequest(req);

  // Get sessionId
  const sessionId = SessionsManager.getSessionFromRequest(req);

  // Log
  D('START ' + sessionId + ' [HLS]');

  // If sessionId is defined
  if (sessionId) SessionsManager.cleanSession(sessionId);
};

/* Route ping */
RoutesTranscode.ping = async (req, res) => {
  // Proxy to Plex
  RoutesProxy.plex(req, res);

  // Extract sessionId from request parameter
  const sessionId = SessionsManager.getSessionFromRequest(req);

  // Choose or get the server url
  const serverUrl = await SessionsManager.chooseServer(sessionId, getIp(req));

  // If a server url is defined, we ping the session
  if (serverUrl) {
    D('PING ' + sessionId + ' [' + serverUrl + ']');
    fetch(serverUrl + '/api/ping?session=' + sessionId);
  } else {
    D('PING ' + sessionId + ' [UNKNOWN]');
  }
};

/* Route timeline */
RoutesTranscode.timeline = async (req, res) => {
  // Proxy to Plex
  RoutesProxy.plex(req, res);

  // Extract sessionId from request parameter
  const sessionId = SessionsManager.getSessionFromRequest(req);

  // Choose or get the server url
  const serverUrl = await SessionsManager.chooseServer(sessionId, getIp(req));

  // It's a stop request
  if (req.query.state === 'stopped') {
    // If a server url is defined, we stop the session
    if (serverUrl) {
      D('STOP ' + sessionId + ' [' + serverUrl + ']');
      fetch(serverUrl + '/api/stop?session=' + sessionId);
    } else {
      D('STOP ' + sessionId + ' [UNKNOWN]');
    }
  }
  // It's a ping request
  else {
    if (serverUrl) {
      D('PING ' + sessionId + ' [' + serverUrl + ']');
      fetch(serverUrl + '/api/ping?session=' + sessionId);
    } else {
      D('PING ' + sessionId + ' [UNKNOWN]');
    }
  }
};

RoutesTranscode.progress = (req, res) => {
  RoutesProxy.plex(req, res);

  D('Progress ' + req.method);
  D('\tURL: ' + req.originalUrl);
  D('\tBody: ' + req.body);
};

/* Route stop */
RoutesTranscode.stop = async (req, res) => {
  // Proxy to plex
  RoutesProxy.plex(req, res);

  // Extract sessionId from request parameter
  const sessionId = SessionsManager.getSessionFromRequest(req);

  // Choose or get the server url
  const serverUrl = await SessionsManager.chooseServer(sessionId, getIp(req));

  // If a server url is defined, we stop the session
  if (serverUrl) {
    D('STOP ' + sessionId + ' [' + serverUrl + ']');
    fetch(serverUrl + '/api/stop?session=' + sessionId);
  } else {
    D('STOP ' + sessionId + ' [UNKNOWN]');
  }
};

/* Route download */
RoutesTranscode.download = async (req, res) => {
  let data;
  try {
    data = await Database.getPartFromId(req.params.id1);
  } catch (ex) {
    if (ex !== 'FILE_NOT_FOUND') {
      // rethrow; we don't handle this
      throw ex;
    }

    res.status(400).send({ error: { code: 'NOT_FOUND', message: 'File not available' } });
    return;
  }

  try {
    const awsUrl = await AWS.getSignedUrlForFile(data.file);
    D('DOWNLOAD ' + req.params.id1 + ' [AWS]');
    res.redirect(302, awsUrl);
    return;
  } catch (ex) {
    if (ex instanceof Error) {
      switch (ex.message) {
        case 'AWS is still initializing':
          // Retry in 3 seconds
          await new Promise((resolve) => {
            setTimeout(resolve, 3000);
          });
          return RoutesTranscode.download(req, res);
          break;
        case 'No AWS signing services are available':
          D('ERROR: DOWNLOAD ' + req.params.id1 + ' [AWS]: No signing services available');
          break;
        case 'AWS S3 mount path is not configured':
          // Ignore; AWS just isn't configured
          break;
        default:
          D('ERROR: DOWNLOAD ' + req.params.id1 + ' [AWS]: ' + ex.message);
      }
    } else {
      D('ERROR: DOWNLOAD ' + req.params.id1 + ' [AWS]: ' + ex);
    }
  }

  // AWS can't handle the download; check if we should send the download to a transcoder
  if (config.custom.download.forward) {
    return RoutesTranscode.redirect(req, res);
  }

  // We don't send downloads to transcoders; send the file ourselves
  D('DOWNLOAD ' + req.params.id1 + ' [LB]');
  const sendFilePromise = new Promise((resolve, reject) => {
    res.sendFile(data.file, {}, (err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });

  try {
    await sendFilePromise;
  } catch (ex) {
    if (ex.code !== 'ECONNABORTED') {
      // rethrow; we don't handle this
      D('DOWNLOAD FAILED ' + req.params.id1 + ' [LB]: ' + ex);
      throw ex;
    }
  }
};

export default RoutesTranscode;
