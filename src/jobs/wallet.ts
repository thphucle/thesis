import {schemas} from "schemas";


async function calcUsdCommission () {
  let commissions = await schemas.Commission.findAll({
    include: [
      {model: schemas.Token, attributes: ['id', 'rate_bdl_usd']}
    ]
  });

  for (let com of commissions) {
    let usd = Math.round((com.Token && com.Token.rate_bdl_usd || 0) * com.bdl * 100) / 100;
    await com.update({
      usd
    });
  }
  console.log("DONE -- ");
}

module.exports = async () => {
  
  await calcUsdCommission();
}
