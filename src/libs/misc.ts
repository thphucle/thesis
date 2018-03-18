var crypto = require('crypto');
var cheerio = require('cheerio');
const fakeUa = require('fake-useragent');
const request = require('request');
const speakeasy = require('speakeasy');
const COIN_API_ENDPOINT = 'https://graphs.coinmarketcap.com/currencies';

async function verifyRecapcha(recapcha) {

  let form = {
    secret: '6LfYMDcUAAAAAEEn3CJcosOU5ELWNmY1sfjoHbbN',
    response: recapcha
  };

  return new Promise(
    (resolve, reject) => request.post({url: 'https://www.google.com/recaptcha/api/siteverify', form}, (err, res, body) => {
      if (err) {
        return reject(err);
      }

      if (body) {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }

        return;
      }

      return reject(false);
    })

  );
}

async function getCurrencyRate(name: string, date?: any) {
  var headers = {
      'User-Agent': fakeUa()
    };
    var d;
    if (date) {
      d = new Date(date);
    } else {
      d = new Date();
    }
    var time = d.getTime();
    var url = `${COIN_API_ENDPOINT}/${name}/${(time - 3 * 60000)}/${(time + 3 * 60000)}`;
    return new Promise((resolve, _) => {
      request.get({ url: url, headers: headers }, function (e, r, body) {
        if (e) {
          return _(e);
        }

        try {
          var obj = JSON.parse(body);
          resolve(parseFloat(obj.price_usd[0][1]));
        } catch (error) {
          return _(error);
        }
      });
    })
}

function boundDate(date: Date, isEnd = false) {
  let day = new Date(date);
  if (isEnd) {
    day.setHours(23);
    day.setMinutes(59);
    day.setSeconds(59);
    day.setMilliseconds(999);
  } else {
    day.setHours(0);
    day.setMinutes(0);
    day.setSeconds(0);
    day.setMilliseconds(0);
  }

  return day;
}

export default {
  uniqueArray: function (arr) {
    var hash = {};
    var result = [];
    arr.forEach(item => hash[item] = 1);
    for (let i in hash) {
      if (hash.hasOwnProperty(i) && hash[i] === 1) {
        result.push(i);
      }
    }
    return result;
  },
  normalize: (str) => {
    let VIETNAMESE_MAP = {
      'á': 'a',
      'à': 'a',
      'ả': 'a',
      'ã': 'a',
      'ạ': 'a',
      'ă': 'a',
      'ắ': 'a',
      'ằ': 'a',
      'ẵ': 'a',
      'ặ': 'a',
      'ẳ': 'a',
      'â': 'a',
      'ấ': 'a',
      'ầ': 'a',
      'ẫ': 'a',
      'ẩ': 'a',
      'ậ': 'a',
      'đ': 'd',
      'é': 'e',
      'è': 'e',
      'ẻ': 'e',
      'ẽ': 'e',
      'ẹ': 'e',
      'ê': 'e',
      'ế': 'e',
      'ề': 'e',
      'ể': 'e',
      'ễ': 'e',
      'ệ': 'e',
      'í': 'i',
      'ì': 'i',
      'ỉ': 'i',
      'ĩ': 'i',
      'ị': 'i',
      'ỏ': 'o',
      'ó': 'o',
      'õ': 'o',
      'ọ': 'o',
      'ò': 'o',
      'ô': 'o',
      'ố': 'o',
      'ồ': 'o',
      'ổ': 'o',
      'ỗ': 'o',
      'ộ': 'o',
      'ơ': 'o',
      'ớ': 'o',
      'ờ': 'o',
      'ở': 'o',
      'ỡ': 'o',
      'ợ': 'o',
      'ù': 'u',
      'ú': 'u',
      'ủ': 'u',
      'ũ': 'u',
      'ụ': 'u',
      'ư': 'u',
      'ứ': 'u',
      'ừ': 'u',
      'ữ': 'u',
      'ử': 'u',
      'ự': 'u',
      'ỳ': 'y',
      'ý': 'y',
      'ỷ': 'y',
      'ỹ': 'y',
      'ỵ': 'y',
      'Á': 'A',
      'À': 'A',
      'Ả': 'A',
      'Ã': 'A',
      'Ạ': 'A',
      'Ă': 'A',
      'Ắ': 'A',
      'Ằ': 'A',
      'Ẵ': 'A',
      'Ặ': 'A',
      'Ẳ': 'A',
      'Â': 'A',
      'Ấ': 'A',
      'Ầ': 'A',
      'Ẫ': 'A',
      'Ẩ': 'A',
      'Ậ': 'A',
      'Đ': 'D',
      'É': 'E',
      'È': 'E',
      'Ẻ': 'E',
      'Ẽ': 'E',
      'Ẹ': 'E',
      'Ê': 'E',
      'Ế': 'E',
      'Ề': 'E',
      'Ể': 'E',
      'Ễ': 'E',
      'Ệ': 'E',
      'Í': 'I',
      'Ì': 'I',
      'Ỉ': 'I',
      'Ĩ': 'I',
      'Ị': 'I',
      'Ô': 'O',
      'Ố': 'O',
      'Ồ': 'O',
      'Ổ': 'O',
      'Ỗ': 'O',
      'Ộ': 'O',
      'Ơ': 'O',
      'Ớ': 'O',
      'Ờ': 'O',
      'Ở': 'O',
      'Ỡ': 'O',
      'Ợ': 'O',
      'Ù': 'U',
      'Ú': 'U',
      'Ủ': 'U',
      'Ũ': 'U',
      'Ụ': 'U',
      'Ư': 'U',
      'Ứ': 'U',
      'Ừ': 'U',
      'Ữ': 'U',
      'Ử': 'U',
      'Ự': 'U',
      'Ỳ': 'Y',
      'Ý': 'Y',
      'Ỷ': 'Y',
      'Ỹ': 'Y',
      'Ỵ': 'Y'
    };
    return str.replace(/[^A-Za-z0-9\[\] ]/g, function (x) {
      return VIETNAMESE_MAP[x] || x;
    });
  },

  CookieParse: function (str) {
    var cookies = decodeURIComponent(str).split(';');
    console.log('cookies:', cookies);
    cookies = cookies.map(function (x) {
      return x.trim();
    });
    console.log('cookies:', cookies);
    var result = {};
    for (let cookie of cookies) {
      let parts = cookie.split('=');
      let index = parts[0];
      let val = parts.splice(1).join('=');
      let json = false;
      try {
        json = JSON.parse(val);
      } catch (e) {

      }
      if (json && typeof json === "object") {
        val = json;
      }
      result[index] = val;
    }
    return result;
  },
  removeBase64Prefix: function (str) {
    var prefix = 'base64,';
    var pos = str.indexOf(prefix);
    if (pos == -1) return str;

    return str.substr(pos + prefix.length);
  },
  sha1: function(str){
    return crypto.createHash('sha1').update(str).digest('hex');
  },
  sha256: function(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
  },
  generateCode: function(n?: number, up=true) {
    n = n || 5;
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < n; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    if (up) {
      text = text.toUpperCase();
    }

    return text;
  },
  snake: function(str) {
    return str.replaceAll(" ", "_")
  },
  encodeBase64: function(str) {
    return new Buffer(str).toString('base64');
  },
  combinations: function(str, separator?: string) {
    var fn = function (active, rest, a) {
      if (!active && rest.length == 0)
        return;
      if (rest.length == 0) {
        a.push(active.trim());
      } else {
        fn(active + (separator ? separator : "") + rest[0], rest.slice(1), a);
        fn(active, rest.slice(1), a);
      }
      return a;
    };
    return fn("", str, []);
  },
  stripHtml: function(str) {
    return str.replace(/(<([^>]+)>)/ig, '');
  },
  extractImageSrcs: function(strHtml) {
    const $ = cheerio.load(strHtml);
    let urls = [];
    $("img").each((_, e) => {
      urls.push($(e).attr('src'));
    });

    return urls;
  },

  getBdlRate: function(date?: any) {
    return getCurrencyRate('bitdeal', date);
  },

  getBtcRate: (date?: any) => {
    return getCurrencyRate('bitcoin', date);
  },

  pad: function(n, width, z?:string) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  },
  replaceAll: function(text, search, replacement) {
    return text.replace(new RegExp(search, 'g'), replacement);
  },
  isInt(n) {
    return (parseInt(n) == n);
  },
  formatNumber(inp, maximumFractionDigits?, local?) {
    var num = Number(inp);
    return num.toLocaleString(local || 'en-US', {maximumFractionDigits: maximumFractionDigits || 2});
  },

  numberOfDays: (from: Date, to: Date) => {
    let fromDate = new Date(from);
    let toDate = new Date(to);

    fromDate.setHours(0);
    fromDate.setMinutes(0);
    fromDate.setSeconds(0);
    fromDate.setMilliseconds(0);

    toDate.setHours(0);
    toDate.setMinutes(0);
    toDate.setSeconds(0);
    toDate.setMilliseconds(0);

    return (toDate.getTime() - fromDate.getTime())/86400000;
  },
  getThisWeek: function(today) {
    let curr = new Date(today);
    curr.setUTCHours(0);
    curr.setUTCMinutes(0);
    curr.setUTCSeconds(0);
    curr.setUTCMilliseconds(0);
    let day = curr.getDay();

    var first = curr.getDate() - day + (day == 0 ? -6:1); // First day is the day of the month - the day of the week
    var last = first + 6; // last day is the first day + 6

    let monday = new Date(curr.setDate(first));
    let sunday = new Date(curr.setDate(last));
    sunday.setUTCHours(23);
    sunday.setUTCMinutes(59);
    sunday.setUTCSeconds(59);
    sunday.setUTCMilliseconds(999);
    return [monday, sunday];
  },
  getBoundOfDate: (date: Date) => {
    let beginDate = new Date(date);
    beginDate.setHours(0);
    beginDate.setMinutes(0);
    beginDate.setSeconds(0);

    let endDate = new Date(date);
    endDate.setHours(23);
    endDate.setMinutes(59);
    endDate.setSeconds(59);
    return [beginDate, endDate];
  },
  getBoundOfPreviousMonth: (now: Date) => {
    let beginPreviousMonth = new Date(now);
    if (now.getMonth()) {
      beginPreviousMonth.setMonth(now.getMonth() - 1);
    } else {
      beginPreviousMonth.setFullYear(now.getFullYear() - 1);
      beginPreviousMonth.setMonth(11);
    }

    beginPreviousMonth.setDate(1);
    beginPreviousMonth = boundDate(beginPreviousMonth);

    let endPreviousMonth = new Date(beginPreviousMonth.getFullYear(), beginPreviousMonth.getMonth() + 1, 0);
    endPreviousMonth = boundDate(endPreviousMonth, true);

    return [beginPreviousMonth, endPreviousMonth];
  },
  toCurrencySticker: (currency:string) => {
    const hash = {
      bitcoin: 'btc',
      bitdeal: 'bdl',
      usd: 'usd'
    };

    return hash[currency];
  },
  eqFloat: function(a: number, b: number) {
    return b - Number.EPSILON < a && a < b + Number.EPSILON;
  },
  gtFloat: function(a: number, b: number) {
    let isEqual = this.eqFloat(a, b);
    if (isEqual) return false;
    return a > b;
  },
  ltFloat: function(a: number, b: number) {
    let isEqual = this.eqFloat(a, b);
    if (isEqual) return false;
    return a < b;
  },
  gteFloat: function(a: number, b: number) {
    let isEqual = this.eqFloat(a, b);
    if (isEqual) return true;
    return a > b;
  },
  lteFloat: function(a: number, b: number) {
    let isEqual = this.eqFloat(a, b);
    if (isEqual) return true;
    return a < b;
  },
  check8FractionDigits (a: number) {
    let s = a.toString();
    let dotIndex = s.indexOf('.');
    if (s.length - dotIndex - 1 > 8) {
      return false;
    }

    return true;
  },
  verifyRecapcha
}
