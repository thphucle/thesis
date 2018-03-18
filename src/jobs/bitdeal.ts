import bitdealModel from 'models/bitdeal';

module.exports = async () => {
  try {
    // let rs = await bitdealModel.getNewAddress();
    // let rs = await bitdealModel.sendToAddress();
    let rs = await bitdealModel.validateAddress('GNRwAiad8g4zduU9DM1RomvrC8Ne2YRH9s');
    console.log("Rs ", rs);
  } catch (error) {
    console.error(error);
  }
}