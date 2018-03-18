import bitgoModel from 'models/bitgo'

export = async function main() {
  let rs = await bitgoModel.createAddress();
  console.log("New address :: ", rs.data);
}