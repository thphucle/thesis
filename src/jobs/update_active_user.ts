import { schemas } from "schemas";
import userModel from "models/user";

export = async function main() {
  let now = new Date();
  let tokens = await schemas.Token.findAll();

  for (let token of tokens) {
    let user = await token.getUser();
    console.log("user :: ", token['id'], user['id']);
    let createDate = new Date(token.created_at);
    let expireDate = createDate.setDate(createDate.getDate() + 30);
    await user.update({
      is_active: true,
      expired_at: expireDate
    });
    await token.update({
      type: 'active'
    });
  }
}
