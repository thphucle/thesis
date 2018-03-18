var config = require('./config');
var GoogleSpreadsheet = require("google-spreadsheet");
var uuid = require("uuid");
const INTERVAL_CHECK_SENCONDS = 3;

async function init(options) {
  try {
    var sheetId = options.id || config.spreadsheet.key;
    var sheet = new GoogleSpreadsheet(sheetId);
    var worksheet = options.worksheet || 0;
    sheet = await getSheet(sheet, options.creds || config.spreadsheet.creds);
    var changeCallbacks = {};
  } catch (e) {
    throw e;
  }
  //detect changes every 30s
  var lastUpdated = new Date();
  setInterval( () => {
    if (Object.keys(changeCallbacks).length == 0) return;
    sheet.getInfo(function(err, sheet_info){
      if (typeof sheet_info != "undefined") {
        var newTime = new Date(sheet_info.updated);
        if (newTime > lastUpdated) {
          console.log('NEW CHANGES');
          lastUpdated = newTime;
          for (let index in changeCallbacks) {
            if (typeof changeCallbacks[index] === 'function') {
              changeCallbacks[index](sheet_info);
            }
          }
        } else {
        }
      }
    });
  }, INTERVAL_CHECK_SENCONDS * 1000);

  return {
    getDefaultInfo: function () {
      return new Promise(async function(resolve, reject) {
        try {
          sheet.getInfo(function(err, sheet_info){
            if (err) return reject(err);
            resolve(sheet_info);
          });
      	} catch (exception) {
      		reject(exception);
      	}
      });
    },
    getInfo: function() {
      return new Promise(async function(resolve, reject) {
        try {
          sheet.getInfo(function(err, sheet_info){
            var sheet1 = sheet_info.worksheets[worksheet];
            if (err) return reject(err);
            sheet1.getRows(function(err1, rows){
                if (err1) return reject(err1);
                resolve(rows);
            });
          });
      	} catch (exception) {
      		reject(exception);
      	}
      });
    },
    getRowsApi : function (ws) {
      return new Promise(async function (resolve, reject) {
        try {
          sheet.getInfo(function(err, sheet_info){
            var sheet1 = sheet_info.worksheets[ws];
            if (err) return reject(err);
            sheet1.getRows(function(err1, rows){
                if (err1) return reject(err1);
                resolve(rows);
            });
          });
      	} catch (exception) {
      		reject(exception);
      	}
      });
    },
    getOverallInfo: function() {
      return new Promise(async function(resolve, reject) {
        try {
          sheet.getInfo(function(err, info) {
            resolve(info);
          });
        } catch (exception) {
          reject(exception);
        }
      })
    },
    addRow: function addRow (data) {
      return new Promise(function(resolve, reject) {
        try {
          sheet.getInfo(function( err, sheet_info ){
            sheet.addRow(worksheet, data, function(err, row) {
              if (err) return reject(err);
              resolve(row);
            });
          });
        } catch (exception) {
          reject(exception)
        }
      });
    },
    subscribe: function(callback) {
      var id = uuid.v4();
      changeCallbacks[id] = callback;
      return id;
    },
    unsubscribe: function(id) {
      delete changeCallbacks[id];
    }
  }
}

async function getSheet(sheet, creds) {
	return new Promise (function (resolve, reject) {
		sheet.useServiceAccountAuth(creds, function(err) {
			if (err) {
				reject(err);
			}
			resolve(sheet);
		});
	});
}

function toDate(x) {
  if (x.getDate) {
    return `=date(${x.getFullYear()}, ${x.getMonth() + 1}, ${x.getDate()})`;
  }
  return x;
}
function toDateString(x) {
  if (x.getDate) {
    return `${x.getMonth() + 1}-${x.getDate()}-${x.getFullYear()}`;
  }
  return x;
}
function toTimeString(x) {
  if (x.getDate) {
    return `${x.getHours()}:${x.getMinutes()}:${x.getSeconds()}`;
  }
  return x;
}
function toDateTimeString(x) {
  if (x.getDate) {
    return `${x.getMonth() + 1}-${x.getDate()}-${x.getFullYear()} ${x.getHours()}:${x.getMinutes()}:${x.getSeconds()}`;
  }
  return x;
}

module.exports = init;
module.exports.toDate = toDate;
module.exports.toDateString = toDateString;
module.exports.toTimeString = toTimeString;
module.exports.toDateTimeString = toDateTimeString;
