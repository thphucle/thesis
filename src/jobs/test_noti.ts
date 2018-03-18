import oneSignal from "../libs/one_signal";
import {schemas, sequelize} from "../schemas";
import mailHelper from "../controllers/helpers/mail-helper";

export = async function main() {
    // let respone = await oneSignal.sendAll({
    //     contents: {"en": "English Message"},
    //     included_segments: ["All"]
    // });
    // console.log("Res", respone);
    // await mailHelper.sendVerifyMail('nguyentuanbk92@gmail.com', {id: 10});
  try {
    let latitude: number = 10.7801739;
    let longitude: number = 106.6694175;
    const query = `
      SELECT
        "id", ST_Distance_Sphere(ST_MakePoint(:latitude, :longitude), "point") AS distance
      FROM
        "Branches"
      WHERE
        ST_Distance_Sphere(ST_MakePoint(:latitude, :longitude), "point") < :maxDistance
      `;

    let branches = await sequelize.query(query, {
        replacements: {
            latitude: latitude,
            longitude: longitude,
            maxDistance: 2 * 1000
        },
        type: sequelize.QueryTypes.SELECT
    });
    console.log("res 1 :: ", branches);
    let branch_ids = [];
    branches.map((branch) => {
      branch_ids.push(branch.id);
    });

    branches = await schemas.Branch.findAll({
      where: {
        id: { in: branch_ids }
      },
      include: [
        {model: schemas.Shop},
        {model: schemas.Image, as: 'feature_image'}
      ]
    });

  } catch (e) {
    console.error("error: ", e.stack);
  }

}
