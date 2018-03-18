import { schemas } from "schemas";
import Request from "libs/request";
import metaModel from "models/meta";

const coinMarketUrl = 'https://graphs.coinmarketcap.com/currencies/bitdeal';
const request = new Request({});

let rates = [];
let rateHash = {};

export = async function main () {
  try {
    let from = await metaModel.get('lastcron_coinmarket');
    from = from.data && from.data.value;
    if (!from) {
      from = new Date('2018-01-17');
      let a = await metaModel.create('lastcron_coinmarket', from.toString());
    }
    from = new Date(from);
    let now = new Date(); 

    let url = `${coinMarketUrl}/${from.getTime()}/${now.getTime()}`;
    let resp = await request.get(url);
    rates = resp.price_btc;
    console.log("rates :: ", rates.length);
    if (!rates.length) return;

    let minute_15 = 15 * 60 * 1000;
    for (let rate of rates) {
      let time = rate[0];
      time = time - (time % minute_15);
      if (!rateHash[time]) {
        rateHash[time] = [];
      }
      rateHash[time].push(rate);
    }

    let data = [];
    console.log("rateHash :: ", Object.keys(rateHash).length);
    for (let time in rateHash) {
      let arrs = rateHash[time];
      if (!arrs.length) continue;
      let open, close, min, max; 
      arrs.sort((a, b) => {
        return a[0] - b[0];
      });
      open = arrs[0][1];
      close = arrs[arrs.length -  1][1];
      arrs.sort((a, b) => {
        return a[1] - b[1];
      });
      min = arrs[0][1];
      max = arrs[arrs.length - 1][1];
      data.push({
        time: parseFloat(time),
        open, close, min, max
      });
    }
    console.log("data :: ", data.length);
    await schemas.RateStatistic.bulkCreate(data);
    await metaModel.update('lastcron_coinmarket', now.toString());
  } catch (e) {
    console.error(e.stack);
  }
}

function Comparator(a, b) {
  if (a[1] < b[1]) return -1;
  if (a[1] > b[1]) return 1;
  return 0;
}