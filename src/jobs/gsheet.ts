const GSheet = require("../libs/gg-sheet");
const config = require('libs/config');
import { schemas } from "schemas";

export = async function () {
  try {
    console.log('Test Sheet is ready');
    var sheetId = config.spreadsheet && config.spreadsheet.key;
    if (!sheetId) {
      console.error("missing sheet key!");
      return;
    }
    let sheet = await GSheet({
      id : sheetId
    });

    console.log("sheet:: ", sheet);
    let sheetSubcribe = sheet.subscribe(function(sheet_info) {
      console.log("sheet_info :: ", sheet_info);
      let sheetSell = sheet_info.worksheets[0];
      let sheetBuy = sheet_info.worksheets[1];
      
      sheetSell.getRows(async function(err1, rows){
        let sellArr = [];
        for (let rowsIndex = 0; rowsIndex < rows.length; rowsIndex++) {
          let data = rows[rowsIndex];
          if (!data.bdl || !data.price || !data.btc) continue;
          let obj = {
            amount: data.bdl,
            price: data.price,
            total: data.btc,
            type: 'sell'
          };
          let checkdb = await schemas.Order.findOne({
            where: obj
          });
          if (!checkdb) {
            sellArr.push(obj);
          }
        }
        await schemas.Order.bulkCreate(sellArr);
      });

      sheetBuy.getRows(async function(err1, rows){
        let buyArr = [];
        for (let rowsIndex = 0; rowsIndex < rows.length; rowsIndex++) {
          let data = rows[rowsIndex];
          if (!data.bdl || !data.price || !data.btc) continue;
          let obj = {
            amount: data.bdl,
            price: data.price,
            total: data.btc,
            type: 'buy'
          };
          let checkdb = await schemas.Order.findOne({
            where: obj
          });
          if (!checkdb) {
            buyArr.push(obj);
          }
        }
        await schemas.Order.bulkCreate(buyArr);
      });

      setTimeout(updateMetaList, 1000);
    });
  } catch (e) {
    console.error(e.stack);
  }
}

async function updateMetaList () {
  try {
    console.log("updateMetaList :: ");
    let last_trade = await schemas.Trade.findAll({
      limit: 1,
      order: [['updated_at', 'desc']]
    });
    if (last_trade) {
      await updateMeta('last_trade_rate', last_trade[0] && last_trade[0].rate_bdl_btc);
    }

    let last_trade_bid = await schemas.Trade.findAll({
      limit: 1,
      order: [['updated_at', 'desc']],
      where: {
        type: 'buy'
      }
    });
    if (last_trade_bid) {
      await updateMeta('last_trade_bid_rate', last_trade_bid[0] && last_trade_bid[0].rate_bdl_btc);
    }

    let last_trade_ask = await schemas.Trade.findAll({
      limit: 1,
      order: [['updated_at', 'desc']],
      where: {
        type: 'sell'
      }
    });
    if (last_trade_ask) {
      await updateMeta('last_trade_ask_rate', last_trade_ask[0] && last_trade_ask[0].rate_bdl_btc);
    }

    let now = new Date();
    let before24h = new Date();
    before24h = new Date(before24h.setDate(before24h.getDate() - 1));

    let vol_24h_trade = await schemas.Trade.sum('total', {
      where: {
        type: 'buy',
        created_at: {
          $gt: before24h,
          $lt: now
        }
      }
    });
    await updateMeta('trade_24h_volumn', vol_24h_trade);

    let high_24h_trade = await schemas.Trade.max('rate_bdl_btc', {
      where: {
        created_at: {
          $gt: before24h,
          $lt: now
        }
      }
    });
    await updateMeta('trade_24h_high', high_24h_trade);

    let low_24h_trade = await schemas.Trade.min('rate_bdl_btc', {
      where: {
        created_at: {
          $gt: before24h,
          $lt: now
        }
      }
    });
    await updateMeta('trade_24h_low', low_24h_trade);
  } catch (e) {
    console.error(e.stack);
  }
}

async function updateMeta (key, value) {
  try {
    console.log("updateMeta :: ", key , value);
    let meta_key = await schemas.Meta.findOne({
      where: {
        key: key
      }
    });
    if (!meta_key) {
      await schemas.Meta.create({
        key: key,
        value: value || 0
      });
    } else {
      await meta_key.update({
        value: value || 0
      })
    }
  } catch (e) {
    console.error(e.stack);
  }
}
