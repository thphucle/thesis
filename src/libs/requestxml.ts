var request = require('request');
var default_options = {
    headers: {
      'Accept': 'text/xml;charset=utf-8',
      'Content-Type': 'text'
    }
};
var parser = require('xml2json');

export default class Request {

    public get;
    public post;
    public put;
    public delete;

    constructor(options) {
        let _this = this;
        var opt = this.init(options);
        ['get', 'post', 'put', 'delete'].map(function(method) {
            _this[method] = req(method, opt);
        });
    }

    init(options) {
        // default using json
        var opt = JSON.parse(
            JSON.stringify(default_options)
        );

        for (var i in options) {
            if (options.hasOwnProperty(i)) {
                opt[i] = options[i];
            }
        }
        return opt;
    }
}

function makeOptions(method, opt) {
    var options : any = {
        timeout: 10000
    };
    for (var i in opt) {
        if (opt.hasOwnProperty(i)) {
            options[i] = opt[i];
        }
    }
    options.method = method;
    return options;
}

function req(method, opt) {
    return function(url, body) {
        var options = makeOptions(method, opt);
        options.url = url;
        options.body = body;

        console.log(new Date() + ' ' + method.toUpperCase() +': ' + url);
        console.log('options');
        console.log(options);
        console.log('------');

        return new Promise(function(resolve, reject) {
            request(options, function (err, res, result) {
              try {
                result = parser.toJson(result);
                result = JSON.parse(result);
              } catch (e) {

              }
              return err ? reject(err) : resolve(result);
            });
        });
    };
}
