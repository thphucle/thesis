import { schemas } from "schemas";
import userModel from "models/user";

export = async function main() {
  let now = new Date();
  let users = await schemas.User.findAll();

  for (let user of users) {
    let level = await userModel.getLevel(user);

    if (level != user.level) {
      await user.update({
        level
      });
    }
  }
}
