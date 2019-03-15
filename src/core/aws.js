import util from 'util';
import debug from 'debug';

import aws from 'aws-sdk';

import config from '../config';

// Debugger
const D = debug('UnicornLoadBalancer:AWS');

const SIGNED_URL_EXPIRE_TIME = 60; // How long a signed URL is valid for in seconds -- 1 minute

/**
 * AWSInterface provides an interface for interacting with AWS.
 */
class AWSInterface {
  /**
   * Constructs and initializes a new AWSInterface
   */
  constructor() {
    this.initialize();
  }

  /**
   * Initializes the AWSInterface to prepare it for use. This is for internal
   * use and is called by the constructor.
   */
  async initialize() {
    this.initialized = false;

    this.metadataService = new aws.MetadataService();
    this.region = await this.getRegion();
    this.ssm = new aws.SSM({ apiVersion: '2014-11-06', region: this.region });
    this.s3 = new aws.S3({ apiVersion: '2006-03-01', region: this.region });

    const initializationPromises = [];
    initializationPromises.push(this.initializeCloudFront());
    initializationPromises.push(this.initializeS3());

    await Promise.all(initializationPromises);

    this.initialized = true;
  }

  /**
   * @return {Boolean} True if the AWSInterface is done initializing, false otherwise.
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Initializes CloudFront signing. This is for internal use and is called by
   * initialize.
   */
  async initializeCloudFront() {
    if (
      config.aws.cloudFront.distributionUrl === '' ||
      config.aws.cloudFront.keypairParameterPath === ''
    ) {
      return;
    }

    this.cloudFront = {};

    this.cloudFront.url = config.aws.cloudFront.distributionUrl;
    if (this.cloudFront.url.endsWith('/')) {
      // Make sure the distribution URL ends with a slash so that we can simply add a key to it later
      this.cloudFront.url = this.cloudFront.url.slice(0, -1);
    }

    const keypairPath = config.aws.cloudFront.keypairParameterPath;
    const ssmRequest = this.ssm.getParameters({
      Names: [`${keypairPath}/keyId`, `${keypairPath}/privkey`],
      WithDecryption: true,
    });
    ssmRequest.send();
    const data = await ssmRequest.promise();

    if (data.InvalidParameters && data.InvalidParameters.length > 0) {
      const invalidParameters = data.InvalidParameters.join(', ');
      D(
        `During request for CloudFront signing key, received invalid parameters: ${invalidParameters}`,
      );
    }

    const parameters = data.Parameters;
    if (parameters.length !== 2) {
      throw new Error(
        `Requested 2 parameters from Parameter Store for CloudFront signing key, but received ${
          parameters.length
        }`,
      );
    }

    let keypairId = null;
    let privateKey = null;

    parameters.forEach((parameter) => {
      if (parameter.Name.endsWith('/privkey')) {
        // This is the private key
        privateKey = parameter.Value;
      } else if (parameter.Name.endsWith('/keyId')) {
        // This is the key ID
        keypairId = parameter.Value;
      } else {
        D(`Received unexpected result from SSM Parameter Store: ${parameter.Name}`);
      }
    });

    if (keypairId === null && privateKey === null) {
      throw new Error(
        'Did not receive keypair ID or private key for CloudFront signing from Parameter Store',
      );
    } else if (keypairId === null) {
      throw new Error('Did not receive keypair ID for CloudFront signing from Parameter Store');
    } else if (privateKey === null) {
      throw new Error('Did not receive private key for CloudFront signing from Parameter Store');
    }

    this.cloudFront.signer = new aws.CloudFront.Signer(keypairId, privateKey);
  }

  /**
   * Initiailizes parameters for S3 signing. This is for internal use and is
   * called by initialize.
   */
  async initializeS3() {
    this.s3Bucket = config.aws.s3.bucket !== '' ? config.aws.s3.bucket : null;
    this.s3MountPoint = config.aws.s3.mountPath !== '' ? config.aws.s3.mountPath : null;
  }

  /**
   * @return {Promise} A promise that resolves to a string containing the region
   *     that this load balancer is in.
   */
  async getRegion() {
    const requestMetadata = util.promisify(this.metadataService.request.bind(this.metadataService));

    const availabilityZone = await requestMetadata(
      '/2018-09-24/meta-data/placement/availability-zone',
    );
    let region;
    if (/[a-zA-Z]/.test(availabilityZone)) {
      // If it ends with a letter, remove the letter to get the region
      region = availabilityZone.slice(0, -1);
    } else {
      // If it doesn't end with a letter, it's already a region name
      region = availabilityZone;
    }

    return region;
  }

  /**
   * getSignedUrlForFile returns a signed S3 URL for a given media file. The given file must be in the S3 mount point.
   * @param {string} filePath The file path to get the URL for.
   * @return {string} A promise that resolves to the signed URL corresponding to the given path.
   */
  async getSignedUrlForFile(filePath) {
    if (!this.isInitialized()) {
      throw new Error('AWS is still initializing');
    }

    if (this.s3MountPoint === null) {
      // If there's no mount path, we can't determine the path to add to a URL
      throw new Error('AWS S3 mount path is not configured');
    }

    if (!filePath.startsWith(config.aws.s3.mountPath)) {
      throw new Error('Given file path is not in the S3 mount point');
    }

    const key = AWSInterface.getEncodedKey(filePath.slice(config.aws.s3.mountPath.length));

    try {
      return await this.getCloudFrontSignedUrl(key);
    } catch (ex) {
      if (!(ex instanceof Error && ex.message === 'Unavailable')) {
        // This is not a simple Unavailable error from the signing function.
        throw ex;
      }
    }

    try {
      return await this.getS3SignedUrl(key);
    } catch (ex) {
      if (!(ex instanceof Error && ex.message === 'Unavailable')) {
        // This is not a simple Unavailable error from the signing function.
        throw ex;
      }
    }

    throw new Error('No AWS signing services are available');
  }

  /**
   * Generates a signed URL for the CloudFront distribution fronting the key.
   * @param  {string} key The key for which a signed URL should be created.
   * @return {Promise} A Promise that resolves to the signed URL.
   */
  async getCloudFrontSignedUrl(key) {
    if (!this.cloudFront || !this.cloudFront.signer) {
      throw new Error('Unavailable');
    }

    const expiresTimestamp = Math.ceil((Date.now() + SIGNED_URL_EXPIRE_TIME * 1000) / 1000);

    return new Promise((resolve, reject) => {
      this.cloudFront.signer.getSignedUrl(
        { url: this.cloudFront.url + key, expires: expiresTimestamp },
        (err, signedUrl) => {
          if (err) {
            reject(err);
          }

          resolve(signedUrl);
        },
      );
    });
  }

  /**
   * Generates a signed URL for the S3 bucket at the given key.
   * @param  {string} key The key for which a signed URL should be created.
   * @return {Promise} A Promise that resolves to the signed URL.
   */
  async getS3SignedUrl(key) {
    if (this.s3Bucket === null) {
      throw new Error('Unavailable');
    }

    return new Promise((resolve, reject) => {
      this.s3.getSignedUrl(
        'getObject',
        { Bucket: this.s3Bucket, Key: key, Expires: SIGNED_URL_EXPIRE_TIME },
        (err, signedUrl) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(signedUrl);
        },
      );
    });
  }

  /**
   * Returns an encoded key, as the browser would encode it. It's critical that
   * this matches the browser's encoding, because the signed URL will fail
   * otherwise.
   * @param  {string} key The key to be encoded.
   * @return {[type]}     The encoded key.
   */
  static getEncodedKey(key) {
    let encodedKey = encodeURI(key);
    encodedKey = encodedKey.replace(/'/g, '%27');
    return encodedKey;
  }
}

export default new AWSInterface();
