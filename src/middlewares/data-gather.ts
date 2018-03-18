export default {
  async gatherData(req, res, next) {
    req.fetch = function () {
      return Object.assign({}, {
        protocol: this.protocol,
        headers: this.headers,
        baseRequestUrl: `${this.protocol}://${this.headers.host}`
      }, this.body, this.params, {jwt: this.jwt}, {files: this.files});
    };
    // console.log("gatherData  :::", req.body, req.params);
    return next();
  },
};
