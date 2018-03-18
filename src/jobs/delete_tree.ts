import {schemas, sequelize} from "../schemas";
import userModel from "models/user";

export = async function main() {
  let username = "bdlvn";

  let users = await userModel.listFromUsername({username});
  let userIds = [];

  for (let user of users.data) {
    userIds.push(user.id);
  }

  console.log("userIds ::", userIds);
  await schemas.User.destroy({
    where: {
       id: userIds
    }
  });

  console.log("---- done -----");
}
