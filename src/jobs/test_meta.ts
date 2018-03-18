import metaModel from 'models/meta'
import { MetaKey } from 'enums/meta-key'

export = async function main() {
  await metaModel.updateRealTime();
  let bdlusd = await metaModel.getExchange(MetaKey.BDL_USD);
  let bdlbtc = await metaModel.getExchange(MetaKey.BDL_BTC);
  let btcusd = await metaModel.getExchange(MetaKey.BTC_USD);
  
  
  console.log("BDLUSD: ", bdlusd);
  console.log("BDLBTC: ", bdlbtc);
  console.log("BTCUSD: ", btcusd);
  
}