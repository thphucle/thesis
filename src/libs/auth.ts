import * as jwt from 'jsonwebtoken';
import * as config from "./config";
import * as speakeasy from "speakeasy";

const JWT_SECRET = config.app.jwt_secret;

async function verify(token) {
    try {
        if (!token) {
            return {
                error: "missing_token"
            };
        }
        let verifyResult = await jwt.verify(token, JWT_SECRET);

        return verifyResult;
    } catch (e) {
        console.log(e);
        return {
            error: e.message
        };
    }
}

async function createToken(obj) {
    let NOW = Date.now() / 1000;
    let payload = {
        exp: NOW + 86400,
        iat: NOW,
        iss: "eye-solution.vn",
        ...obj
    };

    let token = jwt.sign(payload, JWT_SECRET);

    return token;
}

function generateOtpQRCode (label, secret, issuer = '') {
  var url = speakeasy.otpauthURL({ 
      secret: secret, 
      label: label, 
      algorithm: 'sha1', 
      encoding: 'base32',
      issuer
    });

  return url;
}

function verifyOtp(token, secret) {
  var verified = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token
  });

  return verified;
}

function generateOtpSecret(option:any = {}) {
    var otpSecret = speakeasy.generateSecret(option);
    console.log("Otpsercret", otpSecret);
    let secret = otpSecret.base32;

    return secret;
}

export default {
    verify,
    createToken,
    generateOtpSecret,
    generateOtpQRCode,
    verifyOtp
};