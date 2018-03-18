import {schemas} from "schemas";
export = async function () {
  let argv = process.argv.slice(3);
  console.log(argv);
  let rs = await schemas.Product.search(argv[0]);
  console.log("result", rs[0]);
}
