var crypto = require('crypto');
const salt = '<3(XveM+kv?B{b.+';

function sha256(str){
  return crypto.createHash('sha256').update(str).digest('hex');
}

function getMagic(id) {
  return sha256(id + salt);
}

function verifyMagic(id, hash) {
  var magic = getMagic(id);
  if (hash == magic) return true;
  return false;
}

export default {
  getMagic,
  verifyMagic
}
