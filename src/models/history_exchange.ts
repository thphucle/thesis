import { schemas } from "schemas";
import metaModel from "models/meta";
import { MetaKey } from "enums/meta-key";

async function getHistory(fromDate: Date, deltaTime: number) {
  let startDate = new Date(fromDate.getTime() - deltaTime);

  let history = await schemas.HistoryExchange.findOne({
    where: {
      created_at: {
        $gte: startDate
      }
    },
    order: [['id', 'ASC']]
  });

  return history;
}

export default {  

  async updateMeta() {
    const ONE_HOUR = 3600 * 1000;
    let now = new Date();
    let pre1h = new Date(now.getTime() - ONE_HOUR);
    let pre24h = new Date(now.getTime() - 24 * ONE_HOUR);
    let pre7d = new Date(now.getTime() - 7 * 24 * ONE_HOUR);

    let historyPre1h = await getHistory(now, ONE_HOUR);
    let historyPre24h = await getHistory(now, 24 * ONE_HOUR);
    let historyPre7d = await getHistory(now, 7 * 24 * ONE_HOUR);

    let lastRatePre1h = historyPre1h && historyPre1h.rate_bdl_btc;
    let lastRatePre24h = historyPre24h && historyPre24h.rate_bdl_btc;
    let lastRatePre7d = historyPre7d && historyPre7d.rate_bdl_btc;

    let lastRatePre1hUsd = historyPre1h && historyPre1h.rate_bdl_usd;
    let lastRatePre24hUsd = historyPre24h && historyPre24h.rate_bdl_usd;
    let lastRatePre7dUsd = historyPre7d && historyPre7d.rate_bdl_usd;

    let currentTrade = await schemas.Trade.findOne({
      order: [['id', 'DESC']]
    });

    let lastRate = currentTrade.rate_bdl_btc;
    let lastRateUsd = currentTrade.rate_bdl_usd;

    if (lastRatePre1h) {
      let change1h = (lastRate - lastRatePre1h)/lastRatePre1h * 100;
      let percent_change_1h = Math.round(change1h * 100)/100;
      let change1hUsd = (lastRateUsd - lastRatePre1hUsd)/lastRatePre1hUsd * 100;
      let percent_change_1h_usd = Math.round(change1hUsd * 100)/100;

      metaModel.updateAll(MetaKey.PERCENT_CHANGE_1H, percent_change_1h);
      metaModel.updateAll(MetaKey.PERCENT_CHANGE_1H_USD, percent_change_1h_usd);
    }

    if (lastRatePre24h) {
      let change24h = (lastRate - lastRatePre24h)/lastRatePre24h * 100;
      let percent_change_24h = Math.round(change24h * 100)/100;
      let change24hUsd = (lastRateUsd - lastRatePre24hUsd)/lastRatePre24hUsd * 100;
      let percent_change_24h_usd = Math.round(change24hUsd * 100)/100;
      metaModel.updateAll(MetaKey.PERCENT_CHANGE_24H, percent_change_24h);
      metaModel.updateAll(MetaKey.PERCENT_CHANGE_24H_USD, percent_change_24h_usd);
    }

    if (lastRatePre7d) {
      let change7d = (lastRate - lastRatePre7d)/lastRatePre7d * 100;
      let percent_change_7d = Math.round(change7d * 100)/100;
      let change7dUsd = (lastRateUsd - lastRatePre7dUsd)/lastRatePre7dUsd * 100;
      let percent_change_7d_usd = Math.round(change7dUsd * 100)/100;
      metaModel.updateAll(MetaKey.PERCENT_CHANGE_7D, percent_change_7d);
      metaModel.updateAll(MetaKey.PERCENT_CHANGE_7D_USD, percent_change_7d_usd);
    }


    let histories = await schemas.HistoryExchange.findAll({
      where: {
        created_at: {
          $gte: pre24h
        }
      }
    });

    let min = Infinity, max = -Infinity, sumVolume = 0;

    histories.forEach(history => {
      min = Math.min(min, history.rate_bdl_btc);
      max = Math.max(max, history.rate_bdl_btc);
      sumVolume += history.volume;
    });

    console.log("Min max ==> ", min, max, sumVolume);
    if (min !== Infinity) {
      metaModel.updateAll(MetaKey.TRADE_24H_LOW, min);
    }

    if (max !== -Infinity) {
      metaModel.updateAll(MetaKey.TRADE_24H_HIGH, max);    
    }

    metaModel.updateAll(MetaKey.TRADE_24H_VOLUMN, sumVolume);

  },
 
  async cron() {
    console.log("Start cron history exchange");
    let lastHistory = await schemas.HistoryExchange.findOne({
      order: [['id', 'DESC']]
    });
  
    let lastTradeId = lastHistory ? lastHistory.trade_id : 1;
    let sumVolumeBtc = await schemas.Trade.sum('total', {
      where: {
        id: {
          $gte: lastTradeId
        }
      }
    });
  
    let currentTrade = await schemas.Trade.findOne({
      order: [['id', 'DESC']]
    });
  
    if (currentTrade.id != lastTradeId) {
      let history = await schemas.HistoryExchange.create({
        trade_id: currentTrade.id,
        rate_bdl_btc: currentTrade.rate_bdl_btc,
        rate_bdl_usd: currentTrade.rate_bdl_usd,
        volume: sumVolumeBtc
      });      
    }
  

    this.updateMeta();
    
  }
}