import misc from '../libs/misc';

export = async function main() {
  var res = await misc.getBdlRate(new Date().getTime() - 10 * 3600 * 1000);
  console.log(res);
}
