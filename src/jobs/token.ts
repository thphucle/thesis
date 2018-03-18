import { schemas } from '../schemas'
import bitgoModel from '../models/bitgo'
import tokenModel from "models/token";

export = async function() {
  try {
    let rs = tokenModel.getExpectedPackage(450);
    console.log("Resutl ", rs);
  } catch (error) {
    console.error(error.stack);
  }
}